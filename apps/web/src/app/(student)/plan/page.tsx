'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  generatePlan,
  getCurrentPlan,
  getPlanChanges,
  getReadiness,
  type PlanItem,
  type PlanResponse,
  type ReadinessResponse,
} from '../../../lib/content';
import { ApiError } from '../../../lib/apiClient';
import { createSession, sendBlockFeedback } from '../../../lib/practice';
import { WhyThisPanel, BLOCK_LABEL } from '../../../components/WhyThisPanel';
import { ReadinessBand } from '../../../components/ReadinessBand';

interface DayGroup {
  dayIndex: number;
  date: string | null;
  items: PlanItem[];
  total: number;
}

export default function PlanPage() {
  const router = useRouter();
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [readiness, setReadiness] = useState<ReadinessResponse | null>(null);
  const [changes, setChanges] = useState<
    { id: string; trigger: string; summary: Record<string, unknown>; createdAt: string }[]
  >([]);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openWhy, setOpenWhy] = useState<Set<string>>(new Set());
  const [feedbackSent, setFeedbackSent] = useState<Set<string>>(new Set());
  const [feedbackBusy, setFeedbackBusy] = useState<string | null>(null);

  async function sendFeedback(
    itemId: string,
    reason: 'already_know' | 'too_easy' | 'not_relevant',
  ) {
    if (!plan) return;
    setFeedbackBusy(itemId);
    try {
      await sendBlockFeedback(plan.planId, itemId, reason);
      setFeedbackSent((prev) => new Set(prev).add(`${itemId}:${reason}`));
    } finally {
      setFeedbackBusy(null);
    }
  }
  const [pending, setPending] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    getCurrentPlan()
      .then(async (p) => {
        setPlan(p);
        getPlanChanges(p.planId)
          .then((c) => setChanges(c.changes))
          .catch(() => undefined);
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 404) setMissing(true);
        else setError('Could not load your plan.');
      });
    getReadiness()
      .then(setReadiness)
      .catch(() => setReadiness(null));
  }, []);

  const days = useMemo<DayGroup[]>(() => {
    if (!plan) return [];
    const map = new Map<number, PlanItem[]>();
    for (const i of plan.items) {
      const arr = map.get(i.dayIndex) ?? [];
      arr.push(i);
      map.set(i.dayIndex, arr);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a - b)
      .map(([dayIndex, items]) => ({
        dayIndex,
        date: (items[0]?.rationale.date as string | undefined) ?? null,
        items: items.sort((a, b) => a.orderNo - b.orderNo),
        total: items.reduce((s, i) => s + i.minutes, 0),
      }));
  }, [plan]);

  async function startBlock(itemId: string) {
    setStarting(itemId);
    try {
      const s = await createSession({ kind: 'practice', planItemId: itemId });
      router.push(`/practice/session/${s.id}`);
    } catch {
      setError('Could not start the session.');
      setStarting(null);
    }
  }

  async function regenerate() {
    setPending(true);
    setError(null);
    try {
      const p = await generatePlan();
      setPlan(p);
      getPlanChanges(p.planId)
        .then((c) => setChanges(c.changes))
        .catch(() => undefined);
    } catch {
      setError('Could not regenerate the plan.');
    } finally {
      setPending(false);
    }
  }

  if (missing) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Plan</h1>
        <p className="text-neutral-600">
          No plan yet — save your requirements and we&apos;ll generate a time-boxed plan.
        </p>
        <Link
          href="/setup/requirements"
          className="w-fit rounded-md bg-neutral-900 px-5 py-2.5 text-white hover:bg-neutral-700"
        >
          Set up requirements
        </Link>
      </div>
    );
  }

  if (error && !plan) {
    return <p className="text-red-600">{error}</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-xs text-neutral-400 hover:text-neutral-600">
              ← Dashboard
            </Link>
            <Link href="/plan/history" className="text-xs text-blue-600 underline">
              History
            </Link>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Your plan</h1>
          {plan && (
            <p className="mt-1 text-xs text-neutral-500">
              {plan.plannerMethod === 'knapsack' ? 'Optimised plan' : 'Fallback plan'} ·{' '}
              {plan.items.length} blocks · engine {plan.engineVersion}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Link
            href="/setup/requirements"
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-100"
          >
            Edit requirements
          </Link>
          <button
            type="button"
            onClick={() => void regenerate()}
            disabled={pending}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {pending ? 'Generating…' : 'Regenerate'}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <ReadinessBand readiness={readiness} />

      {changes.length > 0 && (
        <details className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
          <summary className="cursor-pointer text-sm font-medium">
            What changed ({changes.length})
          </summary>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-neutral-600">
            {changes.slice(0, 5).map((c) => (
              <li key={c.id}>
                {new Date(c.createdAt).toLocaleString()} — {c.trigger} (
                {String((c.summary as { itemCount?: number }).itemCount ?? '?')} blocks)
              </li>
            ))}
          </ul>
        </details>
      )}

      {days.map((day) => (
        <section
          key={day.dayIndex}
          className="rounded-xl border border-slate-200 bg-white shadow-sm p-4"
        >
          <header className="mb-3 flex items-center justify-between">
            <h2 className="font-medium">
              {day.date
                ? new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                  })
                : `Day ${day.dayIndex + 1}`}
            </h2>
            <span className="text-sm text-neutral-500">{day.total} min</span>
          </header>
          <ol className="flex flex-col gap-2">
            {day.items.map((item) => {
              const whyOpen = openWhy.has(item.id);
              return (
                <li key={item.id} className="rounded-md border px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                        {BLOCK_LABEL[item.blockType] ?? item.blockType}
                      </span>
                      <span className="font-medium">{item.topic.name}</span>
                      {item.pinned && <span title="Pinned">📌</span>}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-neutral-600">
                      <span>{item.minutes} min</span>
                      {item.rationale.date === today && (
                        <button
                          type="button"
                          disabled={starting !== null}
                          onClick={() => void startBlock(item.id)}
                          className="rounded bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
                          {starting === item.id ? '…' : 'Start'}
                        </button>
                      )}
                      <button
                        type="button"
                        aria-expanded={whyOpen}
                        onClick={() =>
                          setOpenWhy((s) => {
                            const n = new Set(s);
                            if (n.has(item.id)) n.delete(item.id);
                            else n.add(item.id);
                            return n;
                          })
                        }
                        className="text-xs text-blue-600 underline"
                      >
                        Why this?
                      </button>
                    </div>
                  </div>
                  {whyOpen && <WhyThisPanel rationale={item.rationale} />}
                  <div className="mt-2 flex items-center gap-2 border-t border-neutral-100 pt-2 text-xs text-neutral-500">
                    <span>This block:</span>
                    {(['already_know', 'too_easy', 'not_relevant'] as const).map((r) => {
                      const key = `${item.id}:${r}`;
                      const label =
                        r === 'already_know'
                          ? 'Already know this'
                          : r === 'too_easy'
                            ? 'Too easy'
                            : 'Not relevant';
                      return (
                        <button
                          key={r}
                          type="button"
                          disabled={feedbackBusy === item.id || feedbackSent.has(key)}
                          onClick={() => void sendFeedback(item.id, r)}
                          className={`rounded-full border px-2 py-0.5 ${
                            feedbackSent.has(key)
                              ? 'border-green-300 bg-green-50 text-green-700'
                              : 'hover:bg-neutral-100'
                          } disabled:opacity-50`}
                        >
                          {feedbackSent.has(key) ? '✓ ' : ''}
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}

      {!plan && !missing && <p className="text-neutral-500">Loading plan…</p>}
    </div>
  );
}
