'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { startReassessment } from '../../../lib/practice';
import { ApiError } from '../../../lib/apiClient';
import { getProfile, type ProfileResponse } from '../../../lib/profile';
import { IconActivity } from '../../../components/Icons';

const KINDS = [
  {
    kind: 'check' as const,
    title: 'Short Check',
    body: '~10 questions across topics — a quick pulse on current retention.',
    minutes: 10,
  },
  {
    kind: 'topic' as const,
    title: 'Targeted Topic Test',
    body: '~15 questions on one topic you select to test deep mastery.',
    minutes: 15,
  },
  {
    kind: 'mock' as const,
    title: 'Full Blueprint Mock',
    body: '~30 questions across sections — closest mirror to actual exam day.',
    minutes: 30,
  },
];

/** P-18 — start a reassessment in pastel & purple aesthetics. */
export default function ReassessmentPage() {
  const router = useRouter();
  const [topics, setTopics] = useState<{ topicId: string; name: string }[]>([]);
  const [topicId, setTopicId] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    getProfile()
      .then((p: ProfileResponse) =>
        setTopics(p.topics.map((t) => ({ topicId: t.topicId, name: t.topic.name }))),
      )
      .catch(() => undefined);
  }, []);

  async function start(kind: 'check' | 'topic' | 'mock') {
    setPending(kind);
    setError(null);
    setNotice(null);
    try {
      const r = await startReassessment({
        kind,
        ...(kind === 'topic' && topicId ? { topicId } : {}),
      });
      if (r.shortened) {
        setNotice(
          `Only ${r.availableQuestions} unseen questions were available, so this will be a shorter session.`,
        );
      }
      router.push(`/practice/session/${r.sessionId}`);
    } catch (e) {
      setError(
        e instanceof ApiError && e.code === 'POOL_EXHAUSTED'
          ? 'No unseen reassessment questions left — practice more first.'
          : e instanceof ApiError
            ? e.message
            : 'Could not start the reassessment.',
      );
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="border-b border-stone-200/70 pb-4">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
          Targeted Reassessments
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          Reassessments strictly serve unseen questions to verify real skill acquisition against
          your initial diagnostic baseline.
        </p>
      </div>

      {notice && (
        <div className="rounded-xl border border-amber-200/80 bg-amber-50/80 p-3.5 text-xs text-amber-900">
          {notice}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/90 p-3.5 text-xs text-rose-800">
          {error}
        </div>
      )}

      {topics.length > 0 && (
        <label className="flex max-w-sm flex-col gap-1.5 text-xs font-bold text-slate-700">
          Select Topic (for Topic Test)
          <select
            value={topicId}
            onChange={(e) => setTopicId(e.target.value)}
            className="glass-input px-3.5 py-2.5 text-xs font-medium"
          >
            <option value="">Select a topic from your syllabus…</option>
            {topics.map((t) => (
              <option key={t.topicId} value={t.topicId}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="grid gap-5 sm:grid-cols-3">
        {KINDS.map((k) => (
          <section
            key={k.kind}
            className="bento-card bento-card-hover p-6 sm:p-7 flex flex-col justify-between gap-5 group bg-white"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100 font-bold text-xs group-hover:bg-indigo-100 transition-colors">
                  <IconActivity className="w-4 h-4" />
                </span>
                <span className="text-[11px] font-semibold text-slate-500 font-mono bg-stone-100 px-2 py-0.5 rounded-full">
                  ~{k.minutes} min
                </span>
              </div>
              <h2 className="text-base font-bold text-slate-900">{k.title}</h2>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">{k.body}</p>
            </div>
            <button
              type="button"
              disabled={pending !== null || (k.kind === 'topic' && !topicId)}
              onClick={() => void start(k.kind)}
              className="btn-primary w-full py-2.5 px-4 text-xs font-semibold disabled:opacity-40 shadow-sm"
            >
              {pending === k.kind ? 'Preparing session…' : `Start (${k.minutes} min)`}
            </button>
          </section>
        ))}
      </div>
    </div>
  );
}
