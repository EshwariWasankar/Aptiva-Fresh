'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getPlan, listPlanVersions, restorePlan, type PlanVersion } from '../../../../lib/practice';
import { getCurrentPlan, type PlanResponse } from '../../../../lib/content';
import { ApiError } from '../../../../lib/apiClient';

/** P-16 — plan version history with restore. */
export default function PlanHistoryPage() {
  const router = useRouter();
  const [versions, setVersions] = useState<PlanVersion[]>([]);
  const [current, setCurrent] = useState<PlanResponse | null>(null);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [comparePlan, setComparePlan] = useState<PlanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);

  useEffect(() => {
    listPlanVersions()
      .then((r) => setVersions(r.plans))
      .catch(() => setError('Could not load plan history.'));
    getCurrentPlan()
      .then(setCurrent)
      .catch(() => undefined);
  }, []);

  async function compare(planId: string) {
    if (planId === compareId) {
      setCompareId(null);
      setComparePlan(null);
      return;
    }
    setCompareId(planId);
    setComparePlan(null);
    const p = await getPlan(planId).catch(() => null);
    setComparePlan(p);
  }

  async function restore(planId: string) {
    setRestoring(planId);
    setError(null);
    try {
      await restorePlan(planId);
      router.push('/plan');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not restore this version.');
      setRestoring(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Plan history</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Every regeneration is kept. Restore copies an earlier version&apos;s future days into a
          new plan — nothing is overwritten.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b bg-neutral-50 text-left text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2">Version</th>
              <th className="px-4 py-2">Created</th>
              <th className="px-4 py-2">Trigger</th>
              <th className="px-4 py-2">Method</th>
              <th className="px-4 py-2">Items</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {versions.map((v) => (
              <tr key={v.planId} className="border-b last:border-0">
                <td className="px-4 py-2">
                  {v.isCurrent && (
                    <span className="mr-2 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">
                      current
                    </span>
                  )}
                  <span className="font-mono text-xs">{v.planId.slice(0, 8)}</span>
                </td>
                <td className="px-4 py-2">{new Date(v.createdAt).toLocaleString()}</td>
                <td className="px-4 py-2">{v.trigger}</td>
                <td className="px-4 py-2">{v.plannerMethod}</td>
                <td className="px-4 py-2">{v.itemCount}</td>
                <td className="px-4 py-2 text-right">
                  {!v.isCurrent && (
                    <>
                      <button
                        type="button"
                        onClick={() => void compare(v.planId)}
                        className="mr-2 text-xs text-blue-600 underline"
                      >
                        {compareId === v.planId ? 'hide' : 'compare'}
                      </button>
                      <button
                        type="button"
                        disabled={restoring !== null}
                        onClick={() => void restore(v.planId)}
                        className="rounded border px-2 py-1 text-xs hover:bg-neutral-100"
                      >
                        {restoring === v.planId ? '…' : 'Restore'}
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {versions.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-neutral-500">
                  No plan versions yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {comparePlan && current && (
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
          <h2 className="text-sm font-medium text-neutral-700">
            Compare: current vs {compareId?.slice(0, 8)}
          </h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 text-sm">
            <div>
              <h3 className="font-medium">Current ({current.items.length} items)</h3>
              <TopicSummary items={current.items} />
            </div>
            <div>
              <h3 className="font-medium">Selected ({comparePlan.items.length} items)</h3>
              <TopicSummary items={comparePlan.items} />
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function TopicSummary({ items }: { items: { topic: { name: string }; minutes: number }[] }) {
  const byTopic = new Map<string, number>();
  for (const i of items) byTopic.set(i.topic.name, (byTopic.get(i.topic.name) ?? 0) + i.minutes);
  const top = [...byTopic.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  return (
    <ul className="mt-1 flex flex-col gap-0.5 text-neutral-600">
      {top.map(([name, mins]) => (
        <li key={name} className="flex justify-between">
          <span>{name}</span>
          <span>{mins}m</span>
        </li>
      ))}
    </ul>
  );
}
