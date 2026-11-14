'use client';

import { useEffect, useState } from 'react';
import { Katex } from '../../../components/Katex';
import { getNotebook, type NotebookEntry } from '../../../lib/practice';
import { IconBook, IconClock, IconCheck } from '../../../components/Icons';

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
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-stone-200/50 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900">
            Spaced Mistake Notebook
          </h1>
          <p className="mt-1 text-xs text-stone-500">
            Missed questions are queued using an Ebbinghaus spaced interval ladder: 1d → 3d → 7d →
            14d.
          </p>
        </div>
        <div className="glass-pill p-1 flex items-center gap-1 shadow-xs border border-white/80 self-start sm:self-auto">
          {(['open', 'resolved', 'all'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full px-3.5 py-1 text-xs font-semibold transition-all ${
                filter === f
                  ? 'glass-pill-active text-stone-900'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              {f[0]!.toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/90 p-3.5 text-xs text-rose-800">
          {error}
        </div>
      )}

      {entries.length === 0 && !error && (
        <div className="glass-card p-12 text-center flex flex-col items-center gap-2">
          <IconBook className="w-8 h-8 text-stone-300" />
          <h3 className="text-sm font-bold text-stone-800">No entries in this view</h3>
          <p className="text-xs text-stone-500 max-w-sm">
            Mistakes and wrong answers from practice drills will be catalogued here for scheduled
            spaced review.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {entries.map((e) => (
          <article key={e.id} className="glass-card glass-card-interactive p-5 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-stone-900 leading-relaxed">
                  <Katex text={e.stem} />
                </div>
                <div className="mt-2 flex items-center gap-2 text-[11px] text-stone-500 flex-wrap">
                  <span className="font-semibold text-stone-700 bg-stone-100/90 px-2 py-0.5 rounded-md">
                    {e.topic.name}
                  </span>
                  <span>·</span>
                  <span>Answered {new Date(e.answeredAt).toLocaleDateString()}</span>
                  {e.errorType && (
                    <>
                      <span>·</span>
                      <span className="text-rose-700 font-medium">Cause: {e.errorType.label}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="shrink-0 text-right">
                {e.resolvedAt ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200/60 px-3 py-1 text-[11px] font-bold text-emerald-800">
                    <IconCheck className="w-3.5 h-3.5" />
                    Resolved
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200/60 px-3 py-1 text-[11px] font-semibold text-amber-800">
                    <IconClock className="w-3.5 h-3.5 text-amber-600" />
                    <span>Retry {e.retryAt ? new Date(e.retryAt).toLocaleDateString() : '—'}</span>
                    {e.retryCount < LADDER.length && (
                      <span className="text-amber-600 font-normal">
                        (stage {e.retryCount + 1}/{LADDER.length})
                      </span>
                    )}
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
