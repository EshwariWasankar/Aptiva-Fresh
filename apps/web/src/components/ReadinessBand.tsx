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
      ? 'bg-[#f5f9dc] text-[#37420c] border-[#c1d16b]'
      : readiness.confidence === 'medium'
        ? 'bg-[#e3eceb] text-[#174c4b] border-[#9daeac]/50'
        : 'bg-amber-50 text-amber-900 border-amber-200/70';

  return (
    <div className="glass-card p-6 flex flex-col justify-between gap-5">
      <div>
        <div className="flex items-center justify-between text-slate-500">
          <span className="text-xs font-bold tracking-wider uppercase text-slate-400 font-mono">
            Target Readiness Band
          </span>
          <span className="p-1.5 rounded-lg bg-[#e3eceb] text-[#174c4b] border border-[#9daeac]/40">
            <IconActivity className="w-4 h-4" />
          </span>
        </div>

        <div className="mt-3 flex items-baseline gap-2">
          <span className="stat-num text-4xl font-extrabold tracking-tight text-slate-900">
            {low}–{high}%
          </span>
          <span className="text-xs font-semibold text-slate-500">estimated pass probability</span>
        </div>

        {/* Visual Target Range Meter in The Performance Lab Teal-to-Chartreuse */}
        <div className="mt-3 relative w-full bg-[#f0f0e9] h-2.5 rounded-full overflow-hidden border border-[#9daeac]/30">
          <div
            className="absolute top-0 bottom-0 bg-gradient-to-r from-[#174c4b] via-[#1b5756] to-[#c1d16b] rounded-full transition-all duration-500 shadow-xs"
            style={{
              left: `${Math.max(0, low - 5)}%`,
              width: `${Math.min(100, Math.max(12, high - low + 10))}%`,
            }}
          />
        </div>

        <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <span>0%</span>
          <span>Target: 75%+</span>
          <span>100%</span>
        </div>

        <div className="mt-2.5 flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${confBadge}`}
          >
            <IconSparkles className="w-3 h-3 text-[#174c4b]" />
            <span className="capitalize">{readiness.confidence} confidence</span>
          </span>
          <span className="text-xs text-slate-400">calibrated from Bayesian priors</span>
        </div>
      </div>

      {/* Inset Action Pill */}
      <Link
        href="/profile"
        className="group flex items-center justify-between rounded-xl bg-white/90 hover:bg-white p-3.5 border border-[#9daeac]/35 hover:border-[#174c4b] transition-all shadow-xs"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e3eceb] shadow-xs border border-[#9daeac]/40 text-[#174c4b]">
            <IconActivity className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900 group-hover:text-[#174c4b] transition-colors">
              Mastery Profile Breakdown
            </div>
            <div className="text-[11px] text-slate-500 line-clamp-1">{readiness.disclaimer}</div>
          </div>
        </div>
        <IconArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-[#174c4b] transition-colors" />
      </Link>
    </div>
  );
}
