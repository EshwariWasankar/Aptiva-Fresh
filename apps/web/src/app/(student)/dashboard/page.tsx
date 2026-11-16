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

/** P-13 — dashboard: readiness band, today's plan, priorities, what changed with modern EdTech Bento aesthetic. */
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
    <div className="flex flex-col gap-8 w-full">
      {/* Overview Header with Live Telemetry Badges */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-[#9daeac]/30 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold tracking-wider uppercase text-slate-400 font-mono">
              Adaptive Workspace
            </span>
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            <span className="text-xs font-semibold text-[#174c4b]">Campus Drive 2026</span>
          </div>
          <h1 className="mt-1 text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            Welcome back, {userDisplayName}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Here is your daily aptitude trajectory and adaptive Knapsack blocks.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {activity && (
            <>
              <span className="rounded-full bg-white border border-[#9daeac]/40 px-3.5 py-1 text-xs font-semibold text-slate-700 shadow-2xs inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#c1d16b] ring-2 ring-[#c1d16b]/40" />
                <span className="stat-num">{activity.currentStreak}</span>
                <span className="text-slate-500 font-medium">day streak</span>
              </span>
              <span className="rounded-full bg-white border border-[#9daeac]/40 px-3.5 py-1 text-xs font-semibold text-slate-700 shadow-2xs inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#174c4b]" />
                <span className="stat-num">{Math.round(activity.totalStudyHours)}</span>
                <span className="text-slate-500 font-medium">hrs total</span>
              </span>
            </>
          )}
          <span className="rounded-full bg-white border border-[#9daeac]/40 px-3.5 py-1 text-xs font-semibold text-slate-800 shadow-2xs">
            {currentMonthYear}
          </span>
        </div>
      </div>

      {/* First Time / Onboarding Banner (if no plan active) */}
      {noPlan && (
        <div className="bento-card p-6 sm:p-8 bg-gradient-to-br from-[#e3eceb]/80 via-white to-[#f5f9dc]/60 border border-[#9daeac]/40 shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex flex-col gap-2 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#f5f9dc] border border-[#c1d16b] px-2.5 py-0.5 text-[11px] font-bold text-[#37420c] w-fit font-mono">
              <IconSparkles className="w-3.5 h-3.5 text-[#174c4b]" />
              <span>Get Started in 3 Steps</span>
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Calibrate your profile to generate today&apos;s adaptive schedule.
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Take the baseline diagnostic to measure your precision across Quant, Logical, Verbal,
              and DI. Next, configure your target assessment date and daily study budget to unlock
              your personalized Knapsack plan.
            </p>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 shrink-0">
            <Link
              href="/onboarding/diagnostic"
              className="btn-primary py-2.5 px-5 text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm"
            >
              <IconCompass className="w-4 h-4" />
              <span>Take Diagnostic</span>
            </Link>
            <Link
              href="/setup/requirements"
              className="btn-secondary py-2.5 px-4 text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <IconSettings className="w-4 h-4 text-slate-400" />
              <span>Configure Target</span>
            </Link>
          </div>
        </div>
      )}

      {/* Primary Top Bento Row: Readiness Band & Today's Plan */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ReadinessBand readiness={readiness} />

        {/* Today's Plan Card */}
        <section className="bento-card p-6 sm:p-7 flex flex-col justify-between gap-5 bg-white">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold tracking-wider uppercase text-slate-400 font-mono">
                  Daily Schedule
                </span>
                <span className="h-1.5 w-1.5 rounded-full bg-[#174c4b]" />
              </div>
              <Link
                href="/plan"
                className="text-xs font-semibold text-[#174c4b] hover:text-[#123c3b] transition inline-flex items-center gap-1"
              >
                Full plan
                <IconArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="mt-3 flex items-baseline justify-between">
              <h2 className="text-xl font-extrabold text-slate-900">Today&apos;s plan</h2>
              <span className="text-xs text-slate-500 font-medium">
                {todayItems.length} block{todayItems.length === 1 ? '' : 's'} scheduled
              </span>
            </div>

            {noPlan ? (
              <div className="mt-4 rounded-xl bg-amber-50/80 border border-amber-200/70 p-4 text-xs text-amber-900">
                No active plan yet —{' '}
                <Link href="/setup/requirements" className="font-bold text-[#174c4b] underline">
                  set up requirements
                </Link>{' '}
                to generate your personalized blueprint.
              </div>
            ) : todayItems.length === 0 ? (
              <div className="mt-4 rounded-xl bg-[#f0f0e9]/60 border border-[#9daeac]/30 p-4 text-xs text-slate-600 flex items-center gap-2.5">
                <IconCalendar className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Rest day or no blocks scheduled for today. Great time for a review!</span>
              </div>
            ) : (
              <ul className="mt-4 flex flex-col gap-2.5">
                {todayItems.map((i) => (
                  <li
                    key={i.id}
                    className="flex items-center justify-between rounded-xl bg-[#f0f0e9]/50 hover:bg-[#f0f0e9] border border-[#9daeac]/30 p-2.5 px-3 transition-colors text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="h-2 w-2 rounded-full bg-[#c1d16b]" />
                      <span className="font-semibold text-slate-800">
                        {BLOCK_LABEL[i.blockType] ?? i.blockType}
                      </span>
                      <span className="text-slate-400">·</span>
                      <span className="text-slate-600 font-medium">{i.topic.name}</span>
                    </div>
                    <span className="font-semibold text-slate-800 bg-white px-2 py-0.5 rounded-md border border-[#9daeac]/30 font-mono shadow-2xs">
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
              className="btn-primary flex items-center justify-center gap-2 w-full py-2.5 px-4 text-sm font-semibold shadow-sm"
            >
              <IconTarget className="w-4 h-4" />
              <span>Start practising</span>
            </Link>
          </div>
        </section>
      </div>

      {/* Compact Study Activity & Streak Summary */}
      <section className="bento-card p-6 bg-white">
        <StudyHeatmap activity={activity} loading={activityLoading} compact />
      </section>

      {/* Secondary Row: Priority Topics & Low Priority / Maintenance */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Priority Topics Card */}
        <section className="bento-card p-6 sm:p-7 flex flex-col justify-between bg-white">
          <div>
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <IconSparkles className="w-4 h-4 text-[#174c4b]" />
                Priority topics
              </h2>
              <span className="text-xs text-slate-400 font-medium font-mono">High leverage</span>
            </div>

            {priorities.length === 0 ? (
              <p className="mt-4 text-xs text-slate-500">No plan priorities available yet.</p>
            ) : (
              <ol className="mt-3 flex flex-col gap-2.5">
                {priorities.map((i, idx) => (
                  <li
                    key={i.id}
                    className="flex items-center justify-between rounded-xl bg-[#f0f0e9]/50 hover:bg-[#f0f0e9] p-2.5 px-3 border border-[#9daeac]/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#e3eceb] text-[11px] font-bold text-[#174c4b] border border-[#9daeac]/40 font-mono">
                        {idx + 1}
                      </span>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-900">{i.topic.name}</span>
                        <span className="text-[11px] text-slate-500 capitalize">
                          {i.blockType.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-slate-700 bg-white px-2 py-0.5 rounded-md border border-[#9daeac]/30 font-mono shadow-2xs">
                      {i.minutes}m
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>

        {/* Low Priority (Maintenance) Card */}
        <section className="bento-card p-6 sm:p-7 flex flex-col justify-between bg-white">
          <div>
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <IconCheck className="w-4 h-4 text-[#174c4b]" />
                Low priority (maintenance)
              </h2>
              <span className="text-xs text-slate-400 font-medium font-mono">Mastered areas</span>
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
                    className="flex items-center justify-between rounded-xl bg-[#f0f0e9]/50 hover:bg-[#f0f0e9] p-2.5 px-3 border border-[#9daeac]/30 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="h-2 w-2 rounded-full bg-[#c1d16b]" />
                      <span className="text-xs font-semibold text-slate-800">{i.topic.name}</span>
                    </div>
                    <span className="text-xs font-semibold text-slate-600 bg-white px-2 py-0.5 rounded-md border border-[#9daeac]/30 font-mono shadow-2xs">
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
        <section className="bento-card border border-[#c1d16b] bg-[#f5f9dc]/80 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <IconSparkles className="w-4 h-4 text-[#174c4b]" />
              What changed in your plan
            </h2>
            <span className="text-xs text-[#174c4b] font-bold font-mono">
              {new Date(latestChange.createdAt).toLocaleDateString()} · {latestChange.trigger}
            </span>
          </div>
          <ul className="mt-3 flex flex-col gap-1.5 text-xs text-slate-800 list-disc list-inside">
            {changeItems.map((c, idx) => (
              <li key={idx}>{c}</li>
            ))}
          </ul>
        </section>
      )}

      {/* Quick Launch Cards Hub (Bento Layout) */}
      <div>
        <div className="mb-3 text-xs font-bold tracking-wider uppercase text-slate-400 font-mono">
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
                className="bento-card bento-card-hover p-5 flex flex-col justify-between gap-3 group bg-white"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e3eceb] text-[#174c4b] border border-[#9daeac]/35 group-hover:bg-[#c1d16b]/20 group-hover:border-[#c1d16b]/60 transition-colors">
                    <Icon className="w-4 h-4" />
                  </span>
                  <IconArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-[#174c4b] transition-colors" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-[#174c4b] transition-colors">
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
