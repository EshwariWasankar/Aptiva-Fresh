'use client';

import Link from 'next/link';
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
    <div className="flex flex-col gap-6">
      <div className="border-b border-stone-200/50 pb-4">
        <Link
          href="/plan"
          className="text-xs font-medium text-stone-400 hover:text-stone-700 transition"
        >
          ← Back to Plan
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-stone-900">
          Plan Version History
        </h1>
        <p className="mt-1 text-xs text-stone-500">
          Every plan generation is saved immutably. Restoring copies previous future blocks into a
          brand new version.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/90 p-3.5 text-xs text-rose-800">
          {error}
        </div>
      )}

      <section className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-stone-100 bg-stone-50/60 text-left uppercase text-stone-400 font-semibold tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Version</th>
                <th className="px-5 py-3.5">Created</th>
                <th className="px-5 py-3.5">Trigger</th>
                <th className="px-5 py-3.5">Method</th>
                <th className="px-5 py-3.5">Blocks</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100/70">
              {versions.map((v) => (
                <tr key={v.planId} className="hover:bg-white/60 transition-colors">
                  <td className="px-5 py-3.5">
                    {v.isCurrent && (
                      <span className="mr-2 rounded-full bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                        active
                      </span>
                    )}
                    <span className="font-mono text-xs text-stone-700">{v.planId.slice(0, 8)}</span>
                  </td>
                  <td className="px-5 py-3.5 text-stone-600">
                    {new Date(v.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3.5 font-medium text-stone-800">{v.trigger}</td>
                  <td className="px-5 py-3.5 text-stone-600 capitalize">{v.plannerMethod}</td>
                  <td className="px-5 py-3.5 font-semibold text-stone-800">{v.itemCount}</td>
                  <td className="px-5 py-3.5 text-right whitespace-nowrap">
                    {!v.isCurrent && (
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void compare(v.planId)}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition"
                        >
                          {compareId === v.planId ? 'Hide' : 'Compare'}
                        </button>
                        <button
                          type="button"
                          disabled={restoring !== null}
                          onClick={() => void restore(v.planId)}
                          className="btn-secondary py-1 px-3 text-xs font-semibold"
                        >
                          {restoring === v.planId ? '…' : 'Restore'}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {versions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-xs text-stone-400">
                    No previous plan versions recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {comparePlan && current && (
        <section className="glass-card p-6 flex flex-col gap-4">
          <h2 className="text-sm font-bold text-stone-900 border-b border-stone-100 pb-3">
            Comparison: Current Active Plan vs {compareId?.slice(0, 8)}
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 text-xs">
            <div className="rounded-xl bg-stone-50/70 p-4 border border-stone-200/40">
              <h3 className="font-bold text-stone-900 mb-2">
                Current ({current.items.length} items)
              </h3>
              <TopicSummary items={current.items} />
            </div>
            <div className="rounded-xl bg-blue-50/50 p-4 border border-blue-200/40">
              <h3 className="font-bold text-blue-900 mb-2">
                Selected ({comparePlan.items.length} items)
              </h3>
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
    <ul className="flex flex-col gap-1 text-stone-600">
      {top.map(([name, mins]) => (
        <li
          key={name}
          className="flex justify-between py-1 border-b border-stone-200/30 last:border-0"
        >
          <span className="font-medium text-stone-700">{name}</span>
          <span className="font-bold text-stone-900">{mins}m</span>
        </li>
      ))}
    </ul>
  );
}
