'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Katex } from '../../../../components/Katex';
import {
  adminListQuestions,
  type Question,
  type QuestionListResult,
  type TopicNode,
  adminListTopics,
} from '../../../../lib/content';
import { ApiError } from '../../../../lib/apiClient';

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-stone-100 text-stone-700 border border-stone-200/50',
  reviewed: 'bg-blue-50 text-blue-700 border border-blue-200/50',
  published: 'bg-emerald-50 text-emerald-700 border border-emerald-200/50',
  retired: 'bg-stone-100 text-stone-400 line-through',
};

export default function QuestionsPage() {
  const [data, setData] = useState<QuestionListResult | null>(null);
  const [topics, setTopics] = useState<TopicNode[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    q: '',
    topicId: '',
    status: '',
    format: '',
    pool: '',
    difficulty: '',
    page: 1,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminListQuestions({
        q: filters.q || undefined,
        topicId: filters.topicId || undefined,
        status: filters.status || undefined,
        format: filters.format || undefined,
        pool: filters.pool || undefined,
        difficulty: filters.difficulty || undefined,
        page: filters.page,
        pageSize: 20,
      });
      setData(res);
    } catch (e) {
      setError(e instanceof ApiError ? `${e.code}: ${e.message}` : 'Failed to load questions');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    adminListTopics()
      .then(setTopics)
      .catch(() => setTopics([]));
  }, []);

  const topicOptions = topics.filter((t) => t.level === 'topic');
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between border-b border-stone-200/50 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">Question Item Bank</h1>
          <p className="mt-1 text-xs text-stone-500">
            Search, filter, and author questions across difficulty bands and pools.
          </p>
        </div>
        <Link href="/admin/questions/new" className="btn-primary py-2 px-4 text-xs font-semibold">
          + New question
        </Link>
      </div>

      {/* Filter Row */}
      <div className="glass-card p-4 flex flex-wrap gap-2.5">
        <input
          type="search"
          placeholder="Search stems…"
          value={filters.q}
          onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value, page: 1 }))}
          className="glass-input px-3 py-1.5 text-xs min-w-48"
        />
        <select
          value={filters.topicId}
          onChange={(e) => setFilters((f) => ({ ...f, topicId: e.target.value, page: 1 }))}
          className="glass-input px-2.5 py-1.5 text-xs"
        >
          <option value="">All topics</option>
          {topicOptions.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value, page: 1 }))}
          className="glass-input px-2.5 py-1.5 text-xs"
        >
          <option value="">All statuses</option>
          {['draft', 'reviewed', 'published', 'retired'].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={filters.format}
          onChange={(e) => setFilters((f) => ({ ...f, format: e.target.value, page: 1 }))}
          className="glass-input px-2.5 py-1.5 text-xs"
        >
          <option value="">All formats</option>
          <option value="mcq">MCQ</option>
          <option value="numerical">Numerical</option>
        </select>
        <select
          value={filters.pool}
          onChange={(e) => setFilters((f) => ({ ...f, pool: e.target.value, page: 1 }))}
          className="glass-input px-2.5 py-1.5 text-xs"
        >
          <option value="">All pools</option>
          {['diagnostic', 'practice', 'reassessment'].map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select
          value={filters.difficulty}
          onChange={(e) => setFilters((f) => ({ ...f, difficulty: e.target.value, page: 1 }))}
          className="glass-input px-2.5 py-1.5 text-xs"
        >
          <option value="">Any difficulty</option>
          {[1, 2, 3].map((d) => (
            <option key={d} value={d}>
              Band {d}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/90 p-3.5 text-xs text-rose-800">
          {error}{' '}
          <button type="button" className="underline font-semibold" onClick={() => void load()}>
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="glass-card p-10 text-center text-xs text-stone-400">Loading questions…</div>
      ) : !data || data.items.length === 0 ? (
        <div className="glass-card p-10 text-center text-xs text-stone-400">
          No questions match the current filters.
        </div>
      ) : (
        <section className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-stone-100 bg-stone-50/60 text-left text-stone-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">Stem</th>
                  <th className="px-4 py-3">Topic</th>
                  <th className="px-4 py-3">Format</th>
                  <th className="px-4 py-3">Pool</th>
                  <th className="px-4 py-3">Band</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100/70">
                {data.items.map((q: Question) => (
                  <tr key={q.id} className="hover:bg-white/60 transition-colors">
                    <td className="max-w-md px-5 py-3">
                      <Link
                        href={`/admin/questions/${q.id}`}
                        className="font-medium text-stone-900 hover:text-blue-600 transition"
                      >
                        <Katex text={q.stem.slice(0, 120) + (q.stem.length > 120 ? '…' : '')} />
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-stone-700 font-medium">{q.topic.name}</td>
                    <td className="px-4 py-3 uppercase text-stone-500 font-mono text-[11px]">
                      {q.format}
                    </td>
                    <td className="px-4 py-3 capitalize text-stone-600">{q.pool}</td>
                    <td className="px-4 py-3 font-semibold text-stone-800">B{q.difficultyPrior}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_STYLE[q.status] ?? ''}`}
                      >
                        {q.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-stone-400 text-[11px]">{q.sourceName ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {data && data.total > data.pageSize && (
        <div className="flex items-center justify-between text-xs text-stone-600 pt-2">
          <span>
            Page {data.page} of {totalPages} · {data.total} total items
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={filters.page <= 1}
              onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
              className="btn-secondary py-1 px-3 text-xs disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={filters.page >= totalPages}
              onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
              className="btn-secondary py-1 px-3 text-xs disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
