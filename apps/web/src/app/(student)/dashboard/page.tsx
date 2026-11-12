'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSession } from '../../../lib/session';
import {
  getCurrentPlan,
  getPlanChanges,
  getReadiness,
  type PlanResponse,
  type ReadinessResponse,
} from '../../../lib/content';
import { ReadinessBand } from '../../../components/ReadinessBand';
import { ApiError } from '../../../lib/apiClient';

interface ChangeEntry {
  id: string;
  trigger: string;
  summary: Record<string, unknown>;
  createdAt: string;
}

const BLOCK_LABEL: Record<string, string> = {
  concept_repair: 'Concept repair',
  targeted_practice: 'Targeted practice',
  timed_set: 'Timed set',
  formula_revision: 'Formula revision',
  mixed_check: 'Mixed check',
  speed_drill: 'Speed drill',
  short_review: 'Short review',
  maintenance: 'Maintenance',
  probe: 'Evidence probe',
};

/** P-13 — dashboard: readiness band, today's plan, priorities, what changed. */
export default function StudentHomePage() {
  const { user } = useSession();
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [noPlan, setNoPlan] = useState(false);
  const [readiness, setReadiness] = useState<ReadinessResponse | null>(null);
  const [changes, setChanges] = useState<ChangeEntry[]>([]);

  useEffect(() => {
    getCurrentPlan()
      .then(async (p) => {
        setPlan(p);
        getPlanChanges(p.planId)
          .then((c) => setChanges(c.changes as ChangeEntry[]))
          .catch(() => undefined);
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 404) setNoPlan(true);
      });
    getReadiness()
      .then(setReadiness)
      .catch(() => setReadiness(null));
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const todayItems = useMemo(
    () =>
      (plan?.items ?? [])
        .filter((i) => i.rationale.date === today)
        .sort((a, b) => a.orderNo - b.orderNo),
    [plan, today],
  );
  const priorities = useMemo(
    () =>
      [...(plan?.items ?? [])]
        .filter((i) => !i.pinned)
        .sort((a, b) => (b.rationale.priority ?? 0) - (a.rationale.priority ?? 0))
        .slice(0, 5),
    [plan],
  );
  const lowPriority = useMemo(
    () => (plan?.items ?? []).filter((i) => i.blockType === 'maintenance').slice(0, 5),
    [plan],
  );
  const latestChange = changes[0];
  const changeItems = (latestChange?.summary?.changes as string[] | undefined) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Welcome back{user?.email ? `, ${user.email}` : ''}.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ReadinessBand readiness={readiness} />

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-neutral-700">Today&apos;s plan</h2>
            <Link href="/plan" className="text-xs text-blue-600 underline">
              Full plan
            </Link>
          </div>
          {noPlan ? (
            <p className="mt-2 text-sm text-neutral-600">
              No plan yet —{' '}
              <Link href="/setup/requirements" className="text-blue-600 underline">
                set up requirements
              </Link>
              .
            </p>
          ) : todayItems.length === 0 ? (
            <p className="mt-2 text-sm text-neutral-500">Rest day or no plan loaded.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              {todayItems.map((i) => (
                <li key={i.id} className="flex justify-between">
                  <span>
                    {BLOCK_LABEL[i.blockType] ?? i.blockType} — {i.topic.name}
                  </span>
                  <span className="text-neutral-500">{i.minutes}m</span>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/practice"
            className="mt-3 inline-block rounded-md bg-neutral-900 px-4 py-2 text-sm text-white"
          >
            Start practising
          </Link>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
          <h2 className="text-sm font-medium text-neutral-700">Priority topics</h2>
          {priorities.length === 0 ? (
            <p className="mt-2 text-sm text-neutral-500">No plan priorities yet.</p>
          ) : (
            <ol className="mt-2 flex flex-col gap-1 text-sm">
              {priorities.map((i, idx) => (
                <li key={i.id} className="flex justify-between">
                  <span>
                    {idx + 1}. {i.topic.name}
                  </span>
                  <span className="text-neutral-500">
                    {i.blockType.replace(/_/g, ' ')} · {i.minutes}m
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
          <h2 className="text-sm font-medium text-neutral-700">Low priority (maintenance)</h2>
          {lowPriority.length === 0 ? (
            <p className="mt-2 text-sm text-neutral-500">
              Strong topics appear here once your profile shows mastery.
            </p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              {lowPriority.map((i) => (
                <li key={i.id} className="flex justify-between">
                  <span>{i.topic.name}</span>
                  <span className="text-neutral-500">{i.minutes}m</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {latestChange && changeItems.length > 0 && (
        <section className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <h2 className="text-sm font-medium text-blue-900">What changed</h2>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-blue-900">
            {changeItems.map((c, idx) => (
              <li key={idx}>{c}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-blue-700">
            {new Date(latestChange.createdAt).toLocaleString()} · {latestChange.trigger}
          </p>
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {[
          {
            href: '/onboarding/diagnostic',
            title: 'Diagnostic',
            body: 'Baseline assessment — take it once.',
          },
          {
            href: '/profile',
            title: 'Profile',
            body: 'Per-topic estimates, intervals and error mix.',
          },
          {
            href: '/notebook',
            title: 'Notebook',
            body: 'Mistakes scheduled for review at 1, 3, 7, 14 days.',
          },
          { href: '/settings', title: 'Settings', body: 'Plan settings and data controls.' },
        ].map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="rounded-xl border border-slate-200 bg-white shadow-sm p-5 transition hover:border-neutral-400"
          >
            <h2 className="mb-1 font-semibold">{c.title}</h2>
            <p className="text-sm text-neutral-600">{c.body}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
