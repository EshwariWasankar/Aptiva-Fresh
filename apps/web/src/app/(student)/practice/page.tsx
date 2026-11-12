'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { getCurrentPlan, type PlanResponse } from '../../../lib/content';
import { createSession } from '../../../lib/practice';
import { ApiError } from '../../../lib/apiClient';

function todayIndex(plan: PlanResponse): number {
  // Day index whose rationale.date is today (UTC).
  const today = new Date().toISOString().slice(0, 10);
  const dates = [...new Set(plan.items.map((i) => i.rationale.date as string | undefined))]
    .filter(Boolean)
    .sort();
  const idx = dates.indexOf(today);
  return idx >= 0 ? idx : -1;
}

/** P-13/P-14 entry — today's plan blocks + custom practice + notebook. */
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
    // rationale.date may repeat across dayIndex; group by the date itself.
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
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Practice</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Work through today&apos;s blocks — feedback is instant and your profile updates when you
            finish.
          </p>
        </div>
        <Link
          href="/notebook"
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-100"
        >
          Mistake notebook
        </Link>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {missing && (
        <p className="text-neutral-600">
          No plan yet —{' '}
          <Link href="/setup/requirements" className="text-blue-600 underline">
            set up your requirements
          </Link>{' '}
          first.
        </p>
      )}

      {todayItems.length === 0 && plan && !missing && (
        <p className="text-neutral-600">Nothing scheduled for today — check your plan.</p>
      )}

      <div className="flex flex-col gap-3">
        {todayItems.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white shadow-sm p-4"
          >
            <div>
              <div className="text-xs uppercase tracking-wide text-neutral-400">
                {item.blockType.replace(/_/g, ' ')}
              </div>
              <div className="font-medium">{item.topic.name}</div>
              <div className="text-sm text-neutral-500">{item.minutes} min</div>
            </div>
            <button
              type="button"
              disabled={starting !== null}
              onClick={() => void start(item.id)}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {starting === item.id ? 'Starting…' : 'Start'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
