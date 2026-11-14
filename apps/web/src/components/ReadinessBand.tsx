'use client';

import Link from 'next/link';
import type { ReadinessResponse } from '../lib/content';
import { IconActivity, IconArrowUpRight, IconSparkles } from './Icons';

/** P-12/P-13 readiness band styled to match the reference hero card aesthetic. */
export function ReadinessBand({ readiness }: { readiness: ReadinessResponse | null }) {
  if (!readiness) return null;
  const low = Math.round(readiness.bandLow * 100);
  const high = Math.round(readiness.bandHigh * 100);

  const confBadge =
    readiness.confidence === 'high'
      ? 'bg-blue-50 text-blue-700 border border-blue-200/60'
      : readiness.confidence === 'medium'
        ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
        : 'bg-stone-100 text-stone-600 border border-stone-200/60';

  return (
    <div className="glass-card p-6 flex flex-col justify-between gap-5">
      <div>
        <div className="flex items-center justify-between text-stone-500">
          <span className="text-xs font-semibold tracking-wide uppercase text-stone-400">
            Target Readiness
          </span>
          <span className="p-1.5 rounded-lg bg-stone-100/80 text-stone-600">
            <IconActivity className="w-4 h-4" />
          </span>
        </div>

        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-4xl font-bold tracking-tight text-stone-900">
            {low}–{high}%
          </span>
        </div>

        <div className="mt-2.5 flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${confBadge}`}
          >
            <IconSparkles className="w-3 h-3 text-blue-600" />
            {readiness.confidence} confidence
          </span>
        </div>
      </div>

      {/* Inset Action Pill matching the reference card's "Everyday account ↗" */}
      <Link
        href="/profile"
        className="group flex items-center justify-between rounded-xl bg-stone-100/70 hover:bg-stone-100 p-3.5 border border-stone-200/60 transition-all"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-xs border border-stone-200/60 text-stone-700">
            <IconActivity className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <div className="text-xs font-semibold text-stone-800">Mastery Profile Breakdown</div>
            <div className="text-[11px] text-stone-500 line-clamp-1">{readiness.disclaimer}</div>
          </div>
        </div>
        <IconArrowUpRight className="w-4 h-4 text-stone-400 group-hover:text-blue-600 transition-colors" />
      </Link>
    </div>
  );
}
