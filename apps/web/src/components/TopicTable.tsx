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

/** P-10 TopicTable — sortable, accessible equivalent of the radar. */
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
    <th className="px-3 py-2 text-left">
      <button
        type="button"
        className="font-medium hover:underline"
        onClick={() => {
          if (sort === key) setDir((d) => (d === 1 ? -1 : 1));
          else {
            setSort(key);
            setDir(key === 'name' ? 1 : -1);
          }
        }}
      >
        {label}
        {sort === key ? (dir === 1 ? ' ↑' : ' ↓') : ''}
      </button>
    </th>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b text-neutral-500">
          <tr>
            {head('name', 'Topic')}
            {head('rating', 'Estimate (range)')}
            {head('attempts', 'Items')}
            {head('accuracy', 'Accuracy EMA')}
            <th className="px-3 py-2 text-left">Error mix</th>
            <th className="px-3 py-2 text-left">Evidence</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.topicId} className="border-b last:border-0">
              <td className="px-3 py-2">
                <div className="font-medium">{r.topic.name}</div>
                <div className="text-xs text-neutral-500">{r.sectionSlug}</div>
              </td>
              <td className="px-3 py-2">
                <span className="font-medium">{Math.round(r.rating)}</span>
                <span className="text-neutral-500">
                  {' '}
                  ({Math.round(r.intervalLow)}–{Math.round(r.intervalHigh)})
                </span>
              </td>
              <td className="px-3 py-2">{r.attemptCount}</td>
              <td className="px-3 py-2">
                {r.accuracyEma != null ? `${Math.round(r.accuracyEma * 100)}%` : '—'}
              </td>
              <td className="px-3 py-2 text-xs">{errorMixSummary(r)}</td>
              <td className="px-3 py-2">
                {r.attemptCount < 15 ? (
                  <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                    Early estimate
                  </span>
                ) : (
                  <span className="text-xs text-neutral-500">ok</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {sorted.length === 0 && (
        <p className="py-6 text-center text-neutral-500">
          No profile data yet — complete the diagnostic to build your baseline.
        </p>
      )}
    </div>
  );
}
