'use client';

import type { ReadinessResponse } from '../lib/content';

/** P-12/P-13 readiness band — a range with a confidence badge, never a bare number. */
export function ReadinessBand({ readiness }: { readiness: ReadinessResponse | null }) {
  if (!readiness) return null;
  const low = Math.round(readiness.bandLow * 100);
  const high = Math.round(readiness.bandHigh * 100);
  const conf =
    readiness.confidence === 'high'
      ? 'bg-green-100 text-green-800'
      : readiness.confidence === 'medium'
        ? 'bg-amber-100 text-amber-800'
        : 'bg-neutral-200 text-neutral-700';
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-neutral-700">Readiness estimate</h2>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${conf}`}>
          {readiness.confidence} confidence
        </span>
      </div>
      <p className="mt-1 text-2xl font-semibold tracking-tight">
        {low}–{high}%
      </p>
      <p className="mt-1 text-xs text-neutral-500">{readiness.disclaimer}</p>
    </div>
  );
}
