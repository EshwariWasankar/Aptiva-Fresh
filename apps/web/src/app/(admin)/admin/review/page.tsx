'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Katex } from '../../../../components/Katex';
import { ApiError } from '../../../../lib/apiClient';
import { adminListQuestions, adminReviewQuestion, type Question } from '../../../../lib/content';

/** P-24 — review queue: draft/reviewed items awaiting a decision (E-061). */
export default function ReviewPage() {
  const [items, setItems] = useState<Question[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<'draft' | 'reviewed'>('draft');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminListQuestions({ status, pageSize: 50 });
      setItems(res.items);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof ApiError ? `${e.code}: ${e.message}` : 'Failed to load queue');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(q: Question, decision: 'approve' | 'reject') {
    setBusy(q.id);
    setError(null);
    try {
      await adminReviewQuestion(q.id, {
        decision,
        notes: notes[q.id]?.trim() || null,
      });
      setItems((rows) => rows.filter((r) => r.id !== q.id));
      setTotal((t) => t - 1);
    } catch (e) {
      setError(e instanceof ApiError ? `${e.code}: ${e.message}` : 'Review failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-[#9daeac]/30 pb-5 gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900">
            Editorial Review Queue
          </h1>
          <p className="mt-1 text-xs text-stone-500">
            {total} item{total === 1 ? '' : 's'} awaiting evaluation. Dual-reviewer approval is
            required for diagnostic publication.
          </p>
        </div>
        <div className="glass-pill p-1 flex items-center gap-1 shadow-xs border border-[#9daeac]/40 self-start sm:self-auto">
          {(['draft', 'reviewed'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`rounded-full px-4 py-1 text-xs font-semibold capitalize transition-all ${
                status === s
                  ? 'bg-[#174c4b] text-white shadow-xs'
                  : 'text-stone-600 hover:text-[#174c4b]'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/90 p-3.5 text-xs text-rose-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="glass-card p-10 text-center text-xs text-stone-400 border border-[#9daeac]/35">
          Loading review queue…
        </div>
      ) : items.length === 0 ? (
        <div className="glass-card p-12 text-center text-xs text-stone-400 border border-[#9daeac]/35">
          Review queue is currently empty for status: {status}.
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {items.map((q) => (
            <li
              key={q.id}
              className="glass-card p-6 flex flex-col gap-3 border border-[#9daeac]/35"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1 flex flex-col gap-2">
                  <Link
                    href={`/admin/questions/${q.id}`}
                    className="font-semibold text-sm text-stone-900 hover:text-[#174c4b] transition"
                  >
                    <Katex text={q.stem.slice(0, 280) + (q.stem.length > 280 ? '…' : '')} />
                  </Link>
                  <div className="flex items-center gap-2 text-[11px] text-stone-500 flex-wrap font-mono">
                    <span className="font-semibold text-stone-700 bg-[#f0f0e9] border border-[#9daeac]/30 px-2 py-0.5 rounded-md">
                      {q.topic.name}
                    </span>
                    <span>·</span>
                    <span className="uppercase">{q.format}</span>
                    <span>·</span>
                    <span>Band {q.difficultyPrior}</span>
                    <span>·</span>
                    <span className="capitalize">{q.pool} pool</span>
                    {q.options.length > 0 && (
                      <>
                        <span>·</span>
                        <span>{q.options.filter((o) => o.isCorrect).length} correct</span>
                      </>
                    )}
                  </div>
                  {q.reviews.length > 0 && (
                    <div className="text-[11px] text-stone-600 bg-[#f0f0e9] p-2 rounded-lg border border-[#9daeac]/30">
                      {q.reviews.length} prior review(s):{' '}
                      {q.reviews.map((r) => `${r.reviewer.email} (${r.decision})`).join(', ')}
                    </div>
                  )}
                  <input
                    className="glass-input mt-1 px-3 py-1.5 text-xs border-[#9daeac]/40 focus:border-[#174c4b]"
                    placeholder="Review notes or feedback for author (optional)…"
                    value={notes[q.id] ?? ''}
                    onChange={(e) => setNotes((n) => ({ ...n, [q.id]: e.target.value }))}
                  />
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    disabled={busy === q.id}
                    onClick={() => void decide(q, 'approve')}
                    className="rounded-xl bg-[#174c4b] hover:bg-[#123c3b] text-white font-semibold px-4 py-2 text-xs transition-colors shadow-2xs disabled:opacity-40"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={busy === q.id}
                    onClick={() => void decide(q, 'reject')}
                    className="btn-secondary py-2 px-4 text-xs font-semibold text-rose-700 hover:bg-rose-50 border-rose-200 disabled:opacity-40"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
