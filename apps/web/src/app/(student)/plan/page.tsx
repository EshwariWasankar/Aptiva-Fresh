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
import { IconCalendar, IconSparkles, IconTarget } from '../../../components/Icons';

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
      <div className="flex flex-col gap-4 max-w-md">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Study Plan</h1>
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
          No plan yet — save your requirements and target assessment, and we&apos;ll generate a
          mathematical time-boxed plan.
        </p>
        <Link
          href="/setup/requirements"
          className="btn-primary w-fit px-5 py-2.5 text-sm font-semibold inline-block"
        >
          Set up requirements
        </Link>
      </div>
    );
  }

  if (error && !plan) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
        {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Top Action Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-stone-200/70 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/dashboard"
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
            >
              ← Overview
            </Link>
            <span className="text-stone-300">·</span>
            <Link
              href="/plan/history"
              className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 hover:underline"
            >
              Plan History
            </Link>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Your Adaptive Plan
          </h1>
          {plan && (
            <p className="mt-1 text-xs text-slate-500">
              <span className="capitalize font-semibold text-slate-700">
                {plan.plannerMethod === 'knapsack'
                  ? 'Optimised knapsack schedule'
                  : 'Priority-based plan'}
              </span>{' '}
              · {plan.items.length} total blocks · Engine v{plan.engineVersion}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            href="/setup/requirements"
            className="btn-secondary px-4 py-2 text-xs font-semibold"
          >
            Edit requirements
          </Link>
          <button
            type="button"
            onClick={() => void regenerate()}
            disabled={pending}
            className="btn-primary px-4 py-2 text-xs font-semibold disabled:opacity-50"
          >
            {pending ? 'Generating…' : 'Regenerate'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/90 p-3.5 text-xs text-rose-800">
          {error}
        </div>
      )}

      {/* Target Readiness */}
      <ReadinessBand readiness={readiness} />

      {/* Plan Changes Accordion */}
      {changes.length > 0 && (
        <details className="bento-card p-5 group bg-white">
          <summary className="cursor-pointer text-xs font-bold text-slate-800 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <IconSparkles className="w-4 h-4 text-indigo-600" />
              Recalibration History ({changes.length} revisions)
            </span>
            <span className="text-slate-400 group-open:rotate-180 transition-transform">▼</span>
          </summary>
          <ul className="mt-3 flex flex-col gap-2 text-xs text-slate-600 border-t border-stone-100 pt-3">
            {changes.slice(0, 5).map((c) => (
              <li key={c.id} className="flex items-center justify-between">
                <span>
                  {new Date(c.createdAt).toLocaleDateString()} —{' '}
                  <strong className="text-slate-800">{c.trigger}</strong>
                </span>
                <span className="text-slate-400 text-[11px] font-mono">
                  {String((c.summary as { itemCount?: number }).itemCount ?? '?')} blocks updated
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* Day Groups */}
      <div className="flex flex-col gap-6">
        {days.map((day) => (
          <section key={day.dayIndex} className="bento-card p-6 flex flex-col gap-4 bg-white">
            <header className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700 font-bold text-xs border border-indigo-100/70">
                  <IconCalendar className="w-4 h-4 text-indigo-600" />
                </span>
                <h2 className="text-base font-bold text-slate-900">
                  {day.date
                    ? new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, {
                        weekday: 'long',
                        month: 'short',
                        day: 'numeric',
                      })
                    : `Day ${day.dayIndex + 1}`}
                </h2>
              </div>
              <span className="rounded-full bg-stone-100 px-3 py-0.5 text-xs font-semibold text-slate-800 border border-stone-200/60 font-mono">
                {day.total} min total
              </span>
            </header>

            <ol className="flex flex-col gap-3">
              {day.items.map((item) => {
                const whyOpen = openWhy.has(item.id);
                return (
                  <li
                    key={item.id}
                    className="rounded-2xl bg-stone-50/70 hover:bg-stone-100/70 border border-stone-200/70 p-4 transition-all"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200/60 px-2.5 py-1 text-xs font-bold font-mono">
                          {BLOCK_LABEL[item.blockType] ?? item.blockType}
                        </span>
                        <span className="font-bold text-sm text-slate-900">{item.topic.name}</span>
                        {item.pinned && (
                          <span title="Pinned by user" className="text-xs">
                            📌
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs">
                        <span className="font-semibold text-slate-800 bg-white px-2.5 py-1 rounded-md border border-stone-200/60 font-mono shadow-2xs">
                          {item.minutes} min
                        </span>
                        {item.rationale.date === today && (
                          <button
                            type="button"
                            disabled={starting !== null}
                            onClick={() => void startBlock(item.id)}
                            className="btn-primary py-1 px-3 text-xs font-semibold disabled:opacity-50 inline-flex items-center gap-1 shadow-2xs"
                          >
                            <IconTarget className="w-3.5 h-3.5" />
                            <span>{starting === item.id ? '…' : 'Start'}</span>
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
                          className="font-semibold text-indigo-700 hover:text-indigo-900 underline transition"
                        >
                          Why this?
                        </button>
                      </div>
                    </div>

                    {whyOpen && <WhyThisPanel rationale={item.rationale} />}

                    <div className="mt-3 flex items-center gap-2 border-t border-stone-100 pt-2.5 text-xs text-slate-500 flex-wrap">
                      <span className="text-[11px] font-semibold text-slate-400">Feedback:</span>
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
                            className={`rounded-full border px-2.5 py-0.5 text-[11px] transition-colors ${
                              feedbackSent.has(key)
                                ? 'border-emerald-300 bg-emerald-50 text-emerald-800 font-semibold'
                                : 'border-stone-200 bg-white/80 text-slate-600 hover:bg-white'
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
      </div>

      {!plan && !missing && <p className="text-xs text-slate-400 text-center">Loading plan…</p>}
    </div>
  );
}
