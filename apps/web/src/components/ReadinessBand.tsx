'use client';

import Link from 'next/link';
import type { ReadinessResponse } from '../lib/content';
import { IconActivity, IconArrowUpRight, IconSparkles } from './Icons';

/** P-12/P-13 readiness band styled with warm glassmorphism aesthetic inspired by reference dashboard. */
export function ReadinessBand({ readiness }: { readiness: ReadinessResponse | null }) {
  if (!readiness) return null;
  const low = Math.round(readiness.bandLow * 100);
  const high = Math.round(readiness.bandHigh * 100);

  const confBadge =
    readiness.confidence === 'high'
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200/70'
      : readiness.confidence === 'medium'
        ? 'bg-blue-50 text-blue-800 border-blue-200/70'
        : 'bg-amber-50 text-amber-800 border-amber-200/70';

  return (
    <div className="glass-card p-6 flex flex-col justify-between gap-5">
      <div>
        <div className="flex items-center justify-between text-slate-500">
          <span className="text-xs font-bold tracking-wider uppercase text-slate-400">
            Target Readiness Band
          </span>
          <span className="p-1.5 rounded-lg bg-blue-50/80 text-blue-700 border border-blue-100/60">
            <IconActivity className="w-4 h-4" />
          </span>
        </div>

        <div className="mt-3 flex items-baseline gap-2">
          <span className="stat-num text-4xl font-extrabold tracking-tight text-slate-900">
            {low}–{high}%
          </span>
        </div>

        <div className="mt-2.5 flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${confBadge}`}
          >
            <IconSparkles className="w-3 h-3 text-blue-600" />
            <span className="capitalize">{readiness.confidence} confidence</span>
          </span>
          <span className="text-xs text-slate-400">calibrated from Bayesian priors</span>
        </div>
      </div>

      {/* Inset Action Pill matching the reference card's "Everyday account ↗" */}
      <Link
        href="/profile"
        className="group flex items-center justify-between rounded-xl bg-white/90 hover:bg-white p-3.5 border border-stone-200/70 hover:border-indigo-300/80 transition-all shadow-xs"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 shadow-xs border border-blue-100/70 text-blue-700">
            <IconActivity className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900 group-hover:text-indigo-900 transition-colors">
              Mastery Profile Breakdown
            </div>
            <div className="text-[11px] text-slate-500 line-clamp-1">{readiness.disclaimer}</div>
          </div>
        </div>
        <IconArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-900 transition-colors" />
      </Link>
    </div>
  );
}
