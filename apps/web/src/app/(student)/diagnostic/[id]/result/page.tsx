'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ApiError } from '../../../../../lib/apiClient';
import { getDiagnosticResult, type DiagnosticResult } from '../../../../../lib/diagnostic';
import { IconSparkles } from '../../../../../components/Icons';

function pct(v: number | null): string {
  return v == null ? '—' : `${Math.round(v * 100)}%`;
}

function ratio(v: number | null): string {
  return v == null ? '—' : `${v.toFixed(2)}×`;
}

/**
 * P-08 — result analysis with pastel & purple aesthetics:
 * topic + difficulty accuracy, time vs expected, skip pattern, consistency, thin-evidence list.
 */
export default function DiagnosticResultPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(true);

  useEffect(() => {
    let tries = 0;
    const poll = async () => {
      try {
        const r = await getDiagnosticResult(id);
        setResult(r.result);
        setPending(false);
      } catch (e) {
        if (e instanceof ApiError && e.code === 'RESULT_NOT_READY' && tries < 30) {
          tries += 1;
          setTimeout(() => void poll(), 1000);
          return;
        }
        setError(e instanceof Error ? e.message : 'Could not load result');
        setPending(false);
      }
    };
    void poll();
  }, [id]);

  if (pending) {
    return (
      <div className="glass-card p-12 text-center text-xs text-slate-400">
        Analysing diagnostic performance and calibrating Bayesian priors…
      </div>
    );
  }
  if (error || !result) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50/90 p-4 text-xs text-rose-800">
        {error ?? 'No diagnostic result found'}
      </div>
    );
  }

  const thinNames = new Map(result.byTopic.map((t) => [t.topicId, t.topicName ?? t.topicId]));

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-[#9daeac]/30 pb-5 gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Diagnostic Analysis &amp; Baseline
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            {result.totals.answered}/{result.totals.questions} answered · {result.totals.correct}{' '}
            correct · {pct(result.totals.accuracy)} overall accuracy
          </p>
        </div>
        {result.coarse && (
          <span className="rounded-full bg-amber-50 border border-amber-200/60 px-3.5 py-1 text-xs font-semibold text-amber-800 shadow-2xs">
            Coarse estimate (express mode)
          </span>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* By Topic Table */}
        <section className="glass-card p-6 flex flex-col gap-3">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Accuracy by Topic
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#9daeac]/30 text-left text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="pb-2.5 pr-2">Topic</th>
                  <th className="pb-2.5 pr-2">Section</th>
                  <th className="pb-2.5 pr-2">Accuracy</th>
                  <th className="pb-2.5 pr-2">Pace</th>
                  <th className="pb-2.5">Evidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#9daeac]/20">
                {result.byTopic.map((t) => (
                  <tr key={t.topicId} className="hover:bg-[#f0f0e9]/70 transition-colors">
                    <td className="py-2.5 pr-2 font-medium text-slate-800">
                      {t.topicName ?? t.topicId.slice(0, 8)}
                    </td>
                    <td className="py-2.5 pr-2 text-slate-500">{t.sectionName ?? '—'}</td>
                    <td className="py-2.5 pr-2 font-bold text-slate-900">{pct(t.accuracy)}</td>
                    <td className="py-2.5 pr-2 text-slate-600">{ratio(t.avgTimeRatio)}</td>
                    <td className="py-2.5">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${
                          t.thinEvidence
                            ? 'bg-amber-50 text-amber-700 border border-amber-200/50'
                            : 'bg-[#e3eceb] text-[#174c4b] border border-[#9daeac]/35'
                        }`}
                      >
                        {t.thinEvidence ? 'thin' : `${t.answered} items`}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Breakdown Metrics */}
        <div className="flex flex-col gap-4">
          <section className="glass-card p-6 flex flex-col gap-2">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Performance by Difficulty Band
            </h2>
            <div className="mt-1 flex flex-col gap-2 text-xs">
              {result.byDifficulty.map((b) => (
                <div
                  key={b.band}
                  className="flex justify-between items-center rounded-xl bg-[#f0f0e9]/60 p-2.5 px-3 border border-[#9daeac]/30"
                >
                  <span className="capitalize font-semibold text-slate-700">{b.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{pct(b.accuracy)}</span>
                    <span className="text-slate-400 text-[11px]">
                      ({b.correct}/{b.attempts})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="glass-card p-6 flex flex-col gap-2 text-xs">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Pacing Analysis
            </h2>
            <div className="mt-1 flex flex-col gap-2">
              <div className="flex justify-between items-center py-1 border-b border-[#9daeac]/20">
                <span className="text-slate-600 font-medium">Avg time vs expected</span>
                <span className="font-bold text-slate-900">
                  {ratio(result.timeVsExpected.avgRatio)}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[#9daeac]/20">
                <span className="text-slate-600 font-medium">Over expected (&gt;1.2×)</span>
                <span className="font-semibold text-slate-800">
                  {pct(result.timeVsExpected.overExpectedShare)}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-600 font-medium">Under expected (&lt;0.8×)</span>
                <span className="font-semibold text-slate-800">
                  {pct(result.timeVsExpected.underExpectedShare)}
                </span>
              </div>
            </div>
          </section>

          <section className="glass-card p-6 flex flex-col gap-2 text-xs">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Fatigue &amp; Consistency
            </h2>
            <div className="mt-1 flex flex-col gap-2">
              <div className="flex justify-between items-center py-1 border-b border-[#9daeac]/20">
                <span className="text-slate-600 font-medium">First half accuracy</span>
                <span className="font-bold text-slate-900">
                  {pct(result.consistency.firstHalfAccuracy)}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[#9daeac]/20">
                <span className="text-slate-600 font-medium">Second half accuracy</span>
                <span className="font-bold text-slate-900">
                  {pct(result.consistency.secondHalfAccuracy)}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-600 font-medium">Accuracy drift</span>
                <span
                  className={
                    result.consistency.unstable
                      ? 'font-bold text-amber-700'
                      : 'font-semibold text-slate-800'
                  }
                >
                  {result.consistency.drift == null
                    ? '—'
                    : `${Math.round(result.consistency.drift * 100)}%`}
                  {result.consistency.unstable ? ' (unstable)' : ''}
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>

      {result.thinEvidence.length > 0 && (
        <section className="rounded-2xl border border-amber-200/80 bg-amber-50/80 p-5 text-xs text-amber-900">
          <h2 className="font-bold text-amber-950 mb-1 flex items-center gap-1.5">
            <IconSparkles className="w-4 h-4 text-amber-600" />
            <span>Thin Evidence Areas</span>
          </h2>
          <p className="leading-relaxed">
            These topics had too few diagnostic items to calibrate high confidence:{' '}
            <strong className="text-amber-950">
              {result.thinEvidence.map((t) => thinNames.get(t) ?? t).join(', ')}
            </strong>
            . Your initial practice plan will automatically insert calibrated probe questions.
          </p>
        </section>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.push(`/diagnostic/${id}/review`)}
          className="btn-primary py-2.5 px-6 text-xs font-semibold"
        >
          Review mistakes →
        </button>
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="btn-secondary py-2.5 px-6 text-xs font-medium"
        >
          OK — back to overview
        </button>
      </div>
    </div>
  );
}
