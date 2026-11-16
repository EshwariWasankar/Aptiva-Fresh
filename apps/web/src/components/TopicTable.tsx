'use client';

import { useMemo, useState } from 'react';
import type { ProfileTopicRow } from '../lib/profile';

type SortKey = 'name' | 'rating' | 'attempts' | 'accuracy';

function errorMixSummary(row: ProfileTopicRow): string {
  const mix = { ...(row.errorMix.reported ?? {}), ...(row.errorMix.inferred ?? {}) };
  const entries = Object.entries(mix).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return '—';
  return entries
    .slice(0, 2)
    .map(([k, n]) => `${k} ×${n}`)
    .join(', ');
}

/** P-10 TopicTable — sortable, accessible equivalent of the radar with purple pastel styling. */
export function TopicTable({ rows }: { rows: ProfileTopicRow[] }) {
  const [sort, setSort] = useState<SortKey>('rating');
  const [dir, setDir] = useState<-1 | 1>(-1);

  const sorted = useMemo(() => {
    const val = (r: ProfileTopicRow): number | string => {
      if (sort === 'name') return r.topic.name;
      if (sort === 'attempts') return r.attemptCount;
      if (sort === 'accuracy') return r.accuracyEma ?? -1;
      return r.rating;
    };
    return [...rows].sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      const cmp = typeof va === 'string' ? va.localeCompare(vb as string) : va - (vb as number);
      return cmp * dir;
    });
  }, [rows, sort, dir]);

  const head = (key: SortKey, label: string) => (
    <th className="px-4 py-3 text-left">
      <button
        type="button"
        className="font-bold text-slate-800 hover:text-indigo-900 transition inline-flex items-center gap-1"
        onClick={() => {
          if (sort === key) setDir((d) => (d === 1 ? -1 : 1));
          else {
            setSort(key);
            setDir(key === 'name' ? 1 : -1);
          }
        }}
      >
        <span>{label}</span>
        <span className="text-[10px] text-slate-400">
          {sort === key ? (dir === 1 ? '▲' : '▼') : ''}
        </span>
      </button>
    </th>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="border-b border-stone-200 bg-stone-50/90 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
          <tr>
            {head('name', 'Topic')}
            <th className="px-4 py-3 text-left font-semibold">Section</th>
            {head('rating', 'Mastery rating')}
            <th className="px-4 py-3 text-left font-semibold">95% interval</th>
            {head('attempts', 'Attempts')}
            {head('accuracy', 'Recent accuracy')}
            <th className="px-4 py-3 text-left font-semibold">Primary errors</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {sorted.map((r) => {
            const acc = r.accuracyEma == null ? '—' : `${Math.round(r.accuracyEma * 100)}%`;
            return (
              <tr key={r.topic.id} className="hover:bg-indigo-50/30 transition-colors">
                <td className="px-4 py-3 font-semibold text-slate-900">{r.topic.name}</td>
                <td className="px-4 py-3 text-slate-500 capitalize">{r.sectionSlug}</td>
                <td className="px-4 py-3 font-mono font-bold text-indigo-950">
                  {r.rating.toFixed(2)}
                </td>
                <td className="px-4 py-3 font-mono text-slate-500">
                  [{r.intervalLow.toFixed(2)}, {r.intervalHigh.toFixed(2)}]
                </td>
                <td className="px-4 py-3 text-slate-700 font-medium">{r.attemptCount}</td>
                <td className="px-4 py-3 font-bold text-slate-800">{acc}</td>
                <td className="px-4 py-3 text-slate-500 text-[11px]">{errorMixSummary(r)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
