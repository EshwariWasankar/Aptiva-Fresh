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

  if (error && !summary) return <p className="text-red-600">{error}</p>;
  if (!summary) return <p className="text-neutral-500">Loading summary…</p>;

  const recalcLabel =
    summary.recalcStatus === 'done'
      ? 'Profile updated'
      : summary.recalcStatus === 'failed'
        ? 'Update failed'
        : 'Updating your profile…';

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <h1 className="text-2xl font-semibold tracking-tight">Session summary</h1>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Answered', String(summary.answered)],
          ['Correct', String(summary.correct)],
          ['Accuracy', summary.accuracy != null ? `${Math.round(summary.accuracy * 100)}%` : '—'],
          ['Avg pace', summary.paceRatio != null ? `${summary.paceRatio.toFixed(2)}×` : '—'],
        ].map(([k, v]) => (
          <div
            key={k}
            className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 text-center"
          >
            <div className="text-2xl font-semibold tracking-tight">{v}</div>
            <div className="text-xs text-neutral-500">{k}</div>
          </div>
        ))}
      </section>

      {summary.topics.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
          <h2 className="text-sm font-medium text-neutral-700">By topic</h2>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {summary.topics.map((t) => (
              <li key={t.topicId} className="flex justify-between">
                <span>{t.name}</span>
                <span className="text-neutral-500">
                  {t.correct}/{t.attempted}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div
        className={`rounded-lg border p-4 text-sm ${
          summary.recalcStatus === 'failed'
            ? 'border-amber-300 bg-amber-50 text-amber-900'
            : 'border-neutral-200 bg-neutral-50 text-neutral-700'
        }`}
      >
        {recalcLabel}
        {summary.recalcStatus === 'failed' && (
          <button
            type="button"
            onClick={() => void retry()}
            disabled={retrying}
            className="ml-3 rounded border border-amber-400 px-3 py-1 text-xs"
          >
            {retrying ? 'Retrying…' : 'Retry'}
          </button>
        )}
      </div>

      <div className="flex gap-3">
        <Link
          href="/plan"
          className="rounded-md bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          View updated plan
        </Link>
        <Link href="/practice" className="rounded-md border px-5 py-2 text-sm">
          Back to practice
        </Link>
      </div>
    </div>
  );
}
