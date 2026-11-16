'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError } from '../../../../lib/apiClient';
import {
  createDiagnostic,
  getActiveDiagnostic,
  type DiagnosticActive,
} from '../../../../lib/diagnostic';
import { IconCompass, IconClock, IconSparkles } from '../../../../components/Icons';

/**
 * P-06 — diagnostic intro: explains what the diagnostic
 * measures, offers standard vs express with pastel & purple aesthetics.
 */
export default function OnboardingDiagnosticPage() {
  const router = useRouter();
  const [active, setActive] = useState<DiagnosticActive | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nearTest, setNearTest] = useState(false);

  useEffect(() => {
    getActiveDiagnostic()
      .then(setActive)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  async function start(mode: 'standard' | 'express') {
    setBusy(mode);
    setError(null);
    try {
      const d = await createDiagnostic(mode);
      router.push(`/diagnostic/${d.id}`);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'DIAGNOSTIC_ACTIVE' && e.details) {
        const id = (e.details as { diagnosticId?: string }).diagnosticId;
        if (id) {
          router.push(`/diagnostic/${id}`);
          return;
        }
      }
      setError(e instanceof Error ? e.message : 'Could not start the diagnostic');
      setBusy(null);
    }
  }

  if (loading) return <p className="text-xs text-slate-400">Loading…</p>;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="border-b border-stone-200/70 pb-5">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 border border-indigo-200/60 px-3 py-0.5 text-xs font-bold text-indigo-700 mb-2 font-mono">
          <IconCompass className="w-3.5 h-3.5" />
          <span>Baseline Assessment</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
          Setup Baseline Diagnostic
        </h1>
        <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed max-w-2xl">
          This timed assessment establishes your baseline profile across Quantitative Aptitude,
          Logical Reasoning, Data Interpretation, and Verbal Ability. It never penalizes your score
          — it strictly calibrates your adaptive plan.
        </p>
      </div>

      {active && (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/80 p-5 shadow-xs flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-950 uppercase tracking-wider font-mono">
              In-Progress Session Detected
            </span>
            <span className="text-xs text-indigo-800 font-semibold font-mono">
              {active.answeredCount}/{active.questionCount} answered{' '}
              {active.status === 'paused' ? '(paused)' : ''}
            </span>
          </div>
          <p className="text-xs text-indigo-900 leading-relaxed">
            You have an active {active.mode} diagnostic in progress. You can resume right where you
            left off.
          </p>
          <button
            type="button"
            onClick={() => router.push(`/diagnostic/${active.id}`)}
            className="btn-primary w-fit py-2 px-5 text-xs font-semibold"
          >
            Resume diagnostic →
          </button>
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        {/* Core Mode */}
        <div className="bento-card bento-card-hover p-6 sm:p-7 flex flex-col justify-between gap-5 bg-white">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/60 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider font-mono">
                Full Scope
              </span>
              <IconSparkles className="w-4 h-4 text-indigo-600" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Core diagnostic</h2>
            <p className="mt-2 text-xs text-slate-600 leading-relaxed">
              27 questions covering all four aptitude sections · ~30 minutes · Recommended when your
              real test is more than 48 hours away.
            </p>
          </div>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void start('standard')}
            className="btn-primary w-full py-2.5 px-4 text-xs font-semibold disabled:opacity-50 shadow-sm"
          >
            {busy === 'standard' ? 'Starting…' : 'Start core diagnostic'}
          </button>
        </div>

        {/* Express Mode */}
        <div className="bento-card bento-card-hover p-6 sm:p-7 flex flex-col justify-between gap-5 bg-white">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="rounded-md bg-amber-50 text-amber-800 border border-amber-200/60 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider font-mono">
                Rapid
              </span>
              <IconClock className="w-4 h-4 text-amber-600" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Express diagnostic</h2>
            <p className="mt-2 text-xs text-slate-600 leading-relaxed">
              12 questions · ~10–15 minutes · Results are flagged as <em>coarse estimate</em>. Best
              if your actual exam is within 48 hours.
            </p>
            <label className="mt-4 flex items-center gap-2 text-xs text-slate-700 font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={nearTest}
                onChange={(e) => setNearTest(e.target.checked)}
                className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
              />
              <span>My test is within 48 hours</span>
            </label>
          </div>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void start('express')}
            className={`w-full py-2.5 px-4 text-xs font-semibold rounded-xl text-white transition-all disabled:opacity-50 ${
              nearTest
                ? 'bg-amber-600 hover:bg-amber-700 shadow-xs'
                : 'bg-slate-900 hover:bg-slate-800'
            }`}
          >
            {busy === 'express' ? 'Starting…' : 'Start express diagnostic'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/90 p-3.5 text-xs text-rose-800">
          {error}
        </div>
      )}
    </div>
  );
}
