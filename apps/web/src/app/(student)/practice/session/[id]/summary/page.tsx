'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  getSessionSummary,
  retryRecalc,
  type SessionSummary,
} from '../../../../../../lib/practice';
import { ApiError } from '../../../../../../lib/apiClient';
import { IconSparkles } from '../../../../../../components/Icons';

/** P-15 — post-session summary; polls E-043 until recalculation settles. */
export default function SessionSummaryPage() {
  const { id } = useParams<{ id: string }>();
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const s = await getSessionSummary(id);
        if (cancelled) return;
        setSummary(s);
        if (s.recalcStatus === 'pending' || s.recalcStatus === 'none') {
          timer = setTimeout(poll, 2000);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof ApiError ? e.message : 'Could not load summary.');
      }
    };
    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [id]);

  async function retry() {
    setRetrying(true);
    try {
      await retryRecalc(id);
      const s = await getSessionSummary(id);
      setSummary(s);
    } catch {
      setError('Retry failed — please try again later.');
    } finally {
      setRetrying(false);
    }
  }

  if (error && !summary) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50/90 p-4 text-xs text-rose-800">
        {error}
      </div>
    );
  }
  if (!summary) {
    return (
      <div className="glass-card p-10 text-center text-xs text-slate-400">
        Compiling session performance summary…
      </div>
    );
  }

  const recalcLabel =
    summary.recalcStatus === 'done'
      ? 'Profile successfully recalibrated'
      : summary.recalcStatus === 'failed'
        ? 'Profile update failed'
        : 'Recalibrating your mastery profile in background…';

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="border-b border-[#9daeac]/30 pb-4">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          Session Performance Summary
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          Immediate feedback breakdown and Bayesian profile calibration metrics.
        </p>
      </div>

      {/* 4 Stat Cards */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Answered', String(summary.answered)],
          ['Correct', String(summary.correct)],
          ['Accuracy', summary.accuracy != null ? `${Math.round(summary.accuracy * 100)}%` : '—'],
          ['Avg pace', summary.paceRatio != null ? `${summary.paceRatio.toFixed(2)}×` : '—'],
        ].map(([k, v]) => (
          <div
            key={k}
            className="glass-card p-5 text-center flex flex-col justify-center items-center gap-1 border border-[#9daeac]/35"
          >
            <div className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">{v}</div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 font-mono">
              {k}
            </div>
          </div>
        ))}
      </section>

      {/* Topics Breakdown */}
      {summary.topics.length > 0 && (
        <section className="glass-card p-6 flex flex-col gap-3 border border-[#9daeac]/35">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide font-mono">
            Performance by Topic
          </h2>
          <ul className="flex flex-col gap-2">
            {summary.topics.map((t) => (
              <li
                key={t.topicId}
                className="flex items-center justify-between rounded-xl bg-[#f0f0e9] p-3 px-3.5 border border-[#9daeac]/30 text-xs"
              >
                <span className="font-semibold text-slate-800">{t.name}</span>
                <span className="font-bold text-[#174c4b] bg-white px-2.5 py-0.5 rounded-md border border-[#9daeac]/35 font-mono">
                  {t.correct} / {t.attempted} correct
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Recalc Status Banner */}
      <div
        className={`rounded-2xl border p-4 text-xs font-medium flex items-center justify-between ${
          summary.recalcStatus === 'done'
            ? 'border-[#c1d16b] bg-[#f5f9dc] text-[#37420c]'
            : summary.recalcStatus === 'failed'
              ? 'border-rose-200/80 bg-rose-50/80 text-rose-900'
              : 'border-[#9daeac]/40 bg-[#e3eceb] text-[#174c4b]'
        }`}
      >
        <div className="flex items-center gap-2">
          <IconSparkles className="w-4 h-4 text-current" />
          <span>{recalcLabel}</span>
        </div>
        {summary.recalcStatus === 'failed' && (
          <button
            type="button"
            onClick={() => void retry()}
            disabled={retrying}
            className="btn-secondary py-1 px-3 text-[11px] font-semibold"
          >
            {retrying ? 'Retrying…' : 'Retry'}
          </button>
        )}
      </div>

      <div className="flex gap-3 pt-2">
        <Link href="/plan" className="btn-primary py-2.5 px-5 text-xs font-semibold">
          View updated plan →
        </Link>
        <Link href="/practice" className="btn-secondary py-2.5 px-5 text-xs font-medium">
          Back to practice
        </Link>
      </div>
    </div>
  );
}
