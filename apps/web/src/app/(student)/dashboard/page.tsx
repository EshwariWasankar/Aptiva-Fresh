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
import { StudyHeatmap } from '../../../components/StudyHeatmap';
import { getCommitmentActivity, type ActivityHistoryResponse } from '../../../lib/commitments';
import { ApiError } from '../../../lib/apiClient';
import {
  IconCalendar,
  IconCheck,
  IconArrowUpRight,
  IconSparkles,
  IconTarget,
  IconBook,
  IconUser,
  IconSettings,
  IconCompass,
} from '../../../components/Icons';

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

/** P-13 — dashboard: readiness band, today's plan, priorities, what changed with pastel & purple aesthetics. */
export default function StudentHomePage() {
  const { user } = useSession();
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [noPlan, setNoPlan] = useState(false);
  const [readiness, setReadiness] = useState<ReadinessResponse | null>(null);
  const [changes, setChanges] = useState<ChangeEntry[]>([]);
  const [activity, setActivity] = useState<ActivityHistoryResponse | null>(null);
  const [activityLoading, setActivityLoading] = useState(true);

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
    getCommitmentActivity(84)
      .then(setActivity)
      .catch(() => undefined)
      .finally(() => setActivityLoading(false));
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

  const currentMonthYear = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  const userDisplayName = user?.email ? user.email.split('@')[0] : 'Scholar';

  return (
    <div className="flex flex-col gap-8">
      {/* Overview Header with Date Stamp matching the reference image */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between border-b border-purple-100/60 pb-5">
        <div>
          <span className="text-xs font-medium tracking-wide text-slate-500">
            Welcome back, {userDisplayName}
          </span>
          <h1 className="mt-0.5 text-3xl font-bold tracking-tight text-slate-900">Overview</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-white/90 border border-purple-200/60 px-3.5 py-1 text-xs font-medium text-purple-900 shadow-2xs">
            {currentMonthYear}
          </span>
        </div>
      </div>

      {/* Primary Top Row: Readiness Band & Today's Plan */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ReadinessBand readiness={readiness} />

        {/* Today's Plan Card */}
        <section className="glass-card p-6 flex flex-col justify-between gap-5">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold tracking-wide uppercase text-slate-400">
                  Daily Schedule
                </span>
                <span className="h-1.5 w-1.5 rounded-full bg-purple-600"></span>
              </div>
              <Link
                href="/plan"
                className="text-xs font-medium text-purple-600 hover:text-purple-700 transition inline-flex items-center gap-1"
              >
                Full plan
                <IconArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="mt-3 flex items-baseline justify-between">
              <h2 className="text-xl font-bold text-slate-900">Today&apos;s plan</h2>
              <span className="text-xs text-slate-500 font-medium">
                {todayItems.length} block{todayItems.length === 1 ? '' : 's'} scheduled
              </span>
            </div>

            {noPlan ? (
              <div className="mt-4 rounded-xl bg-amber-50/70 border border-amber-200/60 p-4 text-xs text-amber-900">
                No active plan yet —{' '}
                <Link
                  href="/setup/requirements"
                  className="font-semibold text-purple-700 underline"
                >
                  set up requirements
                </Link>{' '}
                to generate your personalized blueprint.
              </div>
            ) : todayItems.length === 0 ? (
              <div className="mt-4 rounded-xl bg-purple-50/50 border border-purple-100/70 p-4 text-xs text-slate-600 flex items-center gap-2.5">
                <IconCalendar className="w-4 h-4 text-purple-400" />
                <span>Rest day or no blocks scheduled for today. Great time for a review!</span>
              </div>
            ) : (
              <ul className="mt-4 flex flex-col gap-2.5">
                {todayItems.map((i) => (
                  <li
                    key={i.id}
                    className="flex items-center justify-between rounded-xl bg-white/70 hover:bg-white/95 border border-purple-100/60 p-2.5 px-3 transition-colors text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="h-2 w-2 rounded-full bg-purple-500"></span>
                      <span className="font-semibold text-slate-800">
                        {BLOCK_LABEL[i.blockType] ?? i.blockType}
                      </span>
                      <span className="text-slate-400">·</span>
                      <span className="text-slate-600 font-medium">{i.topic.name}</span>
                    </div>
                    <span className="font-semibold text-purple-900 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200/50">
                      {i.minutes}m
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="pt-2">
            <Link
              href="/practice"
              className="btn-primary flex items-center justify-center gap-2 w-full py-2.5 px-4 text-sm font-semibold"
            >
              <IconTarget className="w-4 h-4" />
              <span>Start practising</span>
            </Link>
          </div>
        </section>
      </div>

      {/* Compact Study Activity & Streak Summary */}
      <section className="glass-card p-6">
        <StudyHeatmap activity={activity} loading={activityLoading} compact />
      </section>

      {/* Secondary Row: Priority Topics & Low Priority / Maintenance */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Priority Topics Card with purple badge highlights */}
        <section className="glass-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-purple-50 pb-3">
              <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <IconSparkles className="w-4 h-4 text-purple-600" />
                Priority topics
              </h2>
              <span className="text-xs text-slate-400">High leverage</span>
            </div>

            {priorities.length === 0 ? (
              <p className="mt-4 text-xs text-slate-500">No plan priorities available yet.</p>
            ) : (
              <ol className="mt-3 flex flex-col gap-2.5">
                {priorities.map((i, idx) => (
                  <li
                    key={i.id}
                    className="flex items-center justify-between rounded-xl bg-white/70 hover:bg-white/95 p-2.5 px-3 border border-purple-100/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-purple-50 text-[11px] font-bold text-purple-700 border border-purple-200/60">
                        {idx + 1}
                      </span>
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-slate-800">{i.topic.name}</span>
                        <span className="text-[11px] text-slate-500 capitalize">
                          {i.blockType.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-medium text-slate-600 bg-purple-50/50 px-2 py-0.5 rounded-md border border-purple-100">
                      {i.minutes}m
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>

        {/* Low Priority (Maintenance) Card with emerald highlights */}
        <section className="glass-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-purple-50 pb-3">
              <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <IconCheck className="w-4 h-4 text-emerald-600" />
                Low priority (maintenance)
              </h2>
              <span className="text-xs text-slate-400">Mastered areas</span>
            </div>

            {lowPriority.length === 0 ? (
              <p className="mt-4 text-xs text-slate-500">
                Strong topics appear here once your profile demonstrates consistent mastery.
              </p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2.5">
                {lowPriority.map((i) => (
                  <li
                    key={i.id}
                    className="flex items-center justify-between rounded-xl bg-white/70 hover:bg-white/95 p-2.5 px-3 border border-purple-100/50 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                      <span className="text-xs font-medium text-slate-800">{i.topic.name}</span>
                    </div>
                    <span className="text-xs font-medium text-slate-500 bg-purple-50/50 px-2 py-0.5 rounded-md border border-purple-100">
                      {i.minutes}m
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      {/* What Changed Banner (if recalibration occurred) */}
      {latestChange && changeItems.length > 0 && (
        <section className="rounded-2xl border border-purple-200/80 bg-purple-50/80 backdrop-blur-md p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-purple-950 flex items-center gap-2">
              <IconSparkles className="w-4 h-4 text-purple-600" />
              What changed in your plan
            </h2>
            <span className="text-xs text-purple-700 font-medium">
              {new Date(latestChange.createdAt).toLocaleDateString()} · {latestChange.trigger}
            </span>
          </div>
          <ul className="mt-3 flex flex-col gap-1.5 text-xs text-purple-900 list-disc list-inside">
            {changeItems.map((c, idx) => (
              <li key={idx}>{c}</li>
            ))}
          </ul>
        </section>
      )}

      {/* Quick Launch Cards Hub */}
      <div>
        <div className="mb-3 text-xs font-semibold tracking-wide uppercase text-slate-400">
          Core Workspaces
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              href: '/onboarding/diagnostic',
              title: 'Diagnostic',
              body: 'Baseline assessment across aptitude sections.',
              icon: IconCompass,
            },
            {
              href: '/profile',
              title: 'Mastery Profile',
              body: 'Per-topic estimates, confidence intervals & radar.',
              icon: IconUser,
            },
            {
              href: '/notebook',
              title: 'Spaced Notebook',
              body: 'Mistakes scheduled for review at 1, 3, 7, 14 days.',
              icon: IconBook,
            },
            {
              href: '/settings',
              title: 'Plan Settings',
              body: 'Pacing controls, hours/day, commitments & data.',
              icon: IconSettings,
            },
          ].map((c) => {
            const Icon = c.icon;
            return (
              <Link
                key={c.href}
                href={c.href}
                className="glass-card glass-card-interactive p-5 flex flex-col justify-between gap-3 group"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-700 border border-purple-100 group-hover:border-purple-300 group-hover:bg-purple-100/70 transition-colors">
                    <Icon className="w-4 h-4" />
                  </span>
                  <IconArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600 transition-colors" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-purple-600 transition-colors">
                    {c.title}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                    {c.body}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
