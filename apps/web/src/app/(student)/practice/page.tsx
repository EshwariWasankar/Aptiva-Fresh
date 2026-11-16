'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { getCurrentPlan, type PlanResponse } from '../../../lib/content';
import { createSession } from '../../../lib/practice';
import { ApiError } from '../../../lib/apiClient';
import { IconTarget, IconBook, IconCalendar } from '../../../components/Icons';

function todayIndex(plan: PlanResponse): number {
  const today = new Date().toISOString().slice(0, 10);
  const dates = [...new Set(plan.items.map((i) => i.rationale.date as string | undefined))]
    .filter(Boolean)
    .sort();
  const idx = dates.indexOf(today);
  return idx >= 0 ? idx : -1;
}

/** P-13/P-14 entry — today's plan blocks + custom practice + notebook in pastel & purple styling. */
export default function PracticePage() {
  const router = useRouter();
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);

  useEffect(() => {
    getCurrentPlan()
      .then(setPlan)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 404) setMissing(true);
        else setError('Could not load your plan.');
      });
  }, []);

  const todayItems = useMemo(() => {
    if (!plan) return [];
    const di = todayIndex(plan);
    if (di < 0) return [];
    const today = new Date().toISOString().slice(0, 10);
    return plan.items
      .filter((i) => i.rationale.date === today)
      .sort((a, b) => a.orderNo - b.orderNo);
  }, [plan]);

  async function start(itemId: string) {
    setStarting(itemId);
    setError(null);
    try {
      const s = await createSession({ kind: 'practice', planItemId: itemId });
      router.push(`/practice/session/${s.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not start the session.');
      setStarting(null);
    }
  }

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[#9daeac]/30 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Daily Practice Drills
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Work through today&apos;s adaptive blocks — instant step-by-step explanations, feedback,
            and automatic profile calibration.
          </p>
        </div>
        <Link
          href="/notebook"
          className="btn-secondary px-4 py-2 text-xs font-semibold inline-flex items-center gap-1.5 shadow-2xs"
        >
          <IconBook className="w-4 h-4 text-[#174c4b]" />
          <span>Mistake notebook</span>
        </Link>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/90 p-3.5 text-xs text-rose-800">
          {error}
        </div>
      )}

      {missing && (
        <div className="bento-card p-6 flex flex-col gap-3 max-w-md bg-white">
          <p className="text-xs text-slate-600">
            No plan created yet. Configure your requirements first to generate today&apos;s drill
            queue.
          </p>
          <Link
            href="/setup/requirements"
            className="btn-primary w-fit px-4 py-2 text-xs font-semibold"
          >
            Set up requirements
          </Link>
        </div>
      )}

      {todayItems.length === 0 && plan && !missing && (
        <div className="bento-card p-8 text-center flex flex-col items-center gap-2 bg-white">
          <IconCalendar className="w-8 h-8 text-[#9daeac]" />
          <h3 className="text-sm font-bold text-slate-800">No drills scheduled for today</h3>
          <p className="text-xs text-slate-500 max-w-sm">
            You&apos;ve completed your blocks for today, or today is a scheduled rest day. Review
            your Mistake Notebook or inspect your full plan.
          </p>
          <Link href="/plan" className="btn-secondary mt-2 px-4 py-1.5 text-xs font-medium">
            View full plan
          </Link>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {todayItems.map((item) => (
          <div
            key={item.id}
            className="bento-card bento-card-hover p-5 flex items-center justify-between gap-4 bg-white"
          >
            <div className="flex flex-col gap-1">
              <div className="inline-flex items-center gap-2">
                <span className="rounded-md bg-[#e3eceb] text-[#174c4b] border border-[#9daeac]/40 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider font-mono">
                  {item.blockType.replace(/_/g, ' ')}
                </span>
                <span className="text-xs text-slate-400">·</span>
                <span className="text-xs font-semibold text-slate-600">{item.minutes} minutes</span>
              </div>
              <h2 className="text-base font-bold text-slate-900 mt-0.5">{item.topic.name}</h2>
            </div>
            <button
              type="button"
              disabled={starting !== null}
              onClick={() => void start(item.id)}
              className="btn-primary py-2 px-5 text-xs font-semibold disabled:opacity-50 shrink-0 inline-flex items-center gap-1.5 shadow-sm"
            >
              <IconTarget className="w-4 h-4" />
              <span>{starting === item.id ? 'Starting…' : 'Start drill'}</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
