'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { startReassessment } from '../../../lib/practice';
import { ApiError } from '../../../lib/apiClient';
import { getProfile, type ProfileResponse } from '../../../lib/profile';
import { useEffect } from 'react';

const KINDS = [
  {
    kind: 'check' as const,
    title: 'Short check',
    body: '~10 questions across topics — a quick pulse on retention.',
    minutes: 10,
  },
  {
    kind: 'topic' as const,
    title: 'Topic test',
    body: '~15 questions on one topic you choose.',
    minutes: 15,
  },
  {
    kind: 'mock' as const,
    title: 'Mock',
    body: '~30 questions across the blueprint — closest to test day.',
    minutes: 30,
  },
];

/** P-18 — start a reassessment; results compare against baseline. */
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
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reassessment</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Reassessment uses questions you haven&apos;t seen before, so improvement reflects learning
          — not memory. Compare against your diagnostic baseline afterwards.
        </p>
      </div>

      {notice && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {notice}
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {kindTopicPicker(topics, topicId, setTopicId)}

      <div className="grid gap-4 sm:grid-cols-3">
        {KINDS.map((k) => (
          <section
            key={k.kind}
            className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm p-5"
          >
            <h2 className="font-semibold">{k.title}</h2>
            <p className="mt-1 flex-1 text-sm text-neutral-600">{k.body}</p>
            <button
              type="button"
              disabled={pending !== null || (k.kind === 'topic' && !topicId)}
              onClick={() => void start(k.kind)}
              className="mt-4 rounded-md bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-40"
            >
              {pending === k.kind ? 'Starting…' : `Start (${k.minutes} min)`}
            </button>
          </section>
        ))}
      </div>
    </div>
  );
}

function kindTopicPicker(
  topics: { topicId: string; name: string }[],
  topicId: string,
  setTopicId: (v: string) => void,
) {
  if (topics.length === 0) return null;
  return (
    <label className="flex max-w-sm flex-col gap-1 text-sm">
      Topic for topic test
      <select
        value={topicId}
        onChange={(e) => setTopicId(e.target.value)}
        className="rounded border border-neutral-300 px-3 py-2"
      >
        <option value="">Select a topic…</option>
        {topics.map((t) => (
          <option key={t.topicId} value={t.topicId}>
            {t.name}
          </option>
        ))}
      </select>
    </label>
  );
}
