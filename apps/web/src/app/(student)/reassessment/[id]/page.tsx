'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getReassessmentComparison, type ReassessmentComparison } from '../../../../lib/practice';
import { ApiError } from '../../../../lib/apiClient';

const LABEL_TEXT: Record<string, string> = {
  improved: 'Improved',
  declined: 'Declined',
  unchanged: 'Unchanged',
  too_early_to_tell: 'Too early to tell',
  no_baseline: 'No baseline',
};

/** P-18 result — baseline vs now with noise labels and retention. */
export default function ReassessmentResultPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<ReassessmentComparison | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getReassessmentComparison(id)
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load the comparison.'));
  }, [id]);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!data) return <p className="text-neutral-500">Loading comparison…</p>;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reassessment result</h1>
        <p className="mt-1 text-sm text-neutral-600">
          {data.answered} answered ·{' '}
          {data.accuracy != null ? `${Math.round(data.accuracy * 100)}% correct` : '—'}
        </p>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b bg-neutral-50 text-left text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2">Topic</th>
              <th className="px-4 py-2">Baseline → now</th>
              <th className="px-4 py-2">Change</th>
              <th className="px-4 py-2">Retention</th>
            </tr>
          </thead>
          <tbody>
            {data.topics.map((t) => (
              <tr key={t.topicId} className="border-b last:border-0">
                <td className="px-4 py-2 font-mono text-xs">{t.topicId.slice(0, 8)}</td>
                <td className="px-4 py-2">
                  {t.baselineRating != null ? Math.round(t.baselineRating) : '—'} →{' '}
                  {t.currentRating != null ? Math.round(t.currentRating) : '—'}
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      t.label === 'improved'
                        ? 'bg-green-100 text-green-800'
                        : t.label === 'declined'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-neutral-100 text-neutral-600'
                    }`}
                  >
                    {LABEL_TEXT[t.label] ?? t.label}
                  </span>
                  {t.label === 'too_early_to_tell' && (
                    <span className="ml-1 text-xs text-neutral-400">(within noise)</span>
                  )}
                </td>
                <td className="px-4 py-2 text-xs text-neutral-600">
                  {t.retention === 'retained'
                    ? 'Retained'
                    : t.retention === 'decayed'
                      ? 'Fading'
                      : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="flex gap-3">
        <Link href="/reassessment" className="rounded-md border px-4 py-2 text-sm">
          New reassessment
        </Link>
        <Link href="/plan" className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white">
          View plan
        </Link>
      </div>
    </div>
  );
}
