'use client';

import { useEffect, useState } from 'react';
import { Katex } from '../../../components/Katex';
import { getNotebook, type NotebookEntry } from '../../../lib/practice';

const LADDER = [1, 3, 7, 14];

/** P-17 — mistake notebook with the fixed retry ladder. */
export default function NotebookPage() {
  const [entries, setEntries] = useState<NotebookEntry[]>([]);
  const [filter, setFilter] = useState<'open' | 'resolved' | 'all'>('open');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getNotebook(filter === 'all' ? {} : { status: filter })
      .then((r) => setEntries(r.entries))
      .catch(() => setError('Could not load the notebook.'));
  }, [filter]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mistake notebook</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Wrong answers are scheduled for review at 1, 3, 7 and 14 days.
          </p>
        </div>
        <div className="flex gap-1 text-sm">
          {(['open', 'resolved', 'all'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded px-3 py-1 ${
                filter === f ? 'bg-neutral-900 text-white' : 'border hover:bg-neutral-100'
              }`}
            >
              {f[0]!.toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {entries.length === 0 && !error && (
        <p className="text-neutral-600">Nothing here yet — mistakes will appear after practice.</p>
      )}

      <div className="flex flex-col gap-3">
        {entries.map((e) => (
          <article key={e.id} className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Katex text={e.stem} />
                <div className="mt-1 text-xs text-neutral-500">
                  {e.topic.name} · {new Date(e.answeredAt).toLocaleDateString()}
                  {e.errorType && ` · ${e.errorType.label}`}
                </div>
              </div>
              <div className="shrink-0 text-right text-xs">
                {e.resolvedAt ? (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-800">
                    Resolved
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">
                    Retry {e.retryAt ? new Date(e.retryAt).toLocaleDateString() : '—'}
                    {e.retryCount < LADDER.length && ` (stage ${e.retryCount + 1}/4)`}
                  </span>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
