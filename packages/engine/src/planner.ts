import {
  PLAN_MAX_CONSECUTIVE_TOPIC,
  PLAN_MAX_EXTEND_MINUTES,
  PLANNER_BUDGET_MS,
  PLANNER_MAX_DAY_MINUTES,
} from './config.js';
import type { PlanCandidate } from './candidates.js';

/**
 * plan (PH7-T04) — 0/1 knapsack per day with a 250 ms deadline and a
 * deterministic priority-ranked fallback. Pure; never throws for bad
 * input — degenerate inputs yield an empty/fallback plan.
 *
 * Guarantees (T-ML-06/T-013):
 * - item minutes sum exactly to each day's budget (when budget ≥ 1 and
 *   at least one candidate exists; otherwise a filler review block)
 * - deterministic for equal inputs
 * - pinned items preserved and deducted from the day budget
 * - ≤ PLAN_MAX_CONSECUTIVE_TOPIC consecutive blocks per topic
 */

export interface PinnedPlanItem {
  blockType: string;
  topicId: string;
  minutes: number;
  rationale?: Record<string, unknown>;
}

export interface PlanDayInput {
  /** Local date label (YYYY-MM-DD) — carried through to rationale. */
  date: string;
  budgetMinutes: number;
  pinned?: PinnedPlanItem[];
}

export interface PlanInput {
  days: PlanDayInput[];
  candidates: readonly PlanCandidate[];
  /** Knapsack deadline in ms (default PLANNER_BUDGET_MS). */
  budgetMs?: number;
  /** Test hook: force the fallback path. */
  forceFallback?: boolean;
}

export interface PlannedItem {
  dayIndex: number;
  orderNo: number;
  blockType: string;
  topicId: string;
  minutes: number;
  pinned: boolean;
  difficultyBand: number | null;
  rationale: Record<string, unknown>;
}

export interface PlanDayResult {
  dayIndex: number;
  date: string;
  budgetMinutes: number;
  allocatedMinutes: number;
  plannerMethod: 'knapsack' | 'fallback';
}

export interface PlanOutput {
  items: PlannedItem[];
  days: PlanDayResult[];
  plannerMethod: 'knapsack' | 'fallback';
  elapsedMs: number;
}

interface Selected {
  candidate: PlanCandidate;
  extended: number;
}

/** Bounded 0/1 knapsack: candidates × capacity. Returns chosen candidates. */
function knapsack(candidates: readonly PlanCandidate[], capacity: number): PlanCandidate[] {
  const n = candidates.length;
  if (n === 0 || capacity <= 0) return [];
  // Full 2-D DP: dp[i][w] = best value using first i candidates, capacity w.
  const width = capacity + 1;
  const dp = new Float64Array((n + 1) * width);
  for (let i = 1; i <= n; i++) {
    const c = candidates[i - 1]!;
    const w = c.minutes;
    const base = i * width;
    const prev = (i - 1) * width;
    for (let cap = 0; cap <= capacity; cap++) {
      let best = dp[prev + cap]!;
      if (w <= cap) {
        const v = dp[prev + cap - w]! + c.gain;
        if (v > best) best = v;
      }
      dp[base + cap] = best;
    }
  }
  // Reconstruct by walking the DP table.
  const chosen: PlanCandidate[] = [];
  let cap = capacity;
  for (let i = n; i >= 1; i--) {
    const c = candidates[i - 1]!;
    if (
      c.minutes <= cap &&
      dp[i * width + cap] === dp[(i - 1) * width + cap - c.minutes]! + c.gain
    ) {
      chosen.push(c);
      cap -= c.minutes;
    }
  }
  return chosen.reverse();
}

/** Deterministic greedy fallback: gain-per-minute desc. */
function greedyFill(candidates: readonly PlanCandidate[], capacity: number): PlanCandidate[] {
  const sorted = [...candidates].sort(
    (a, b) =>
      b.gainPerMinute - a.gainPerMinute ||
      b.gain - a.gain ||
      a.candidateId.localeCompare(b.candidateId),
  );
  const chosen: PlanCandidate[] = [];
  let used = 0;
  for (const c of sorted) {
    if (used + c.minutes <= capacity) {
      chosen.push(c);
      used += c.minutes;
    }
  }
  return chosen;
}

/** Order selected items so no topic appears >MAX_CONSECUTIVE in a row. */
function orderItems(selected: Selected[]): Selected[] {
  const pool = [...selected];
  const out: Selected[] = [];
  while (pool.length) {
    const lastTopic = out[out.length - 1]?.candidate.topicId;
    const prevTopic = out[out.length - 2]?.candidate.topicId;
    const streak =
      lastTopic !== undefined && lastTopic === prevTopic
        ? PLAN_MAX_CONSECUTIVE_TOPIC // already at the cap for this topic
        : lastTopic !== undefined
          ? 1
          : 0;
    // Pick the highest-gain item that does not push a topic past the cap.
    let idx = -1;
    for (let i = 0; i < pool.length; i++) {
      const cand = pool[i]!.candidate;
      const wouldStreak = cand.topicId === lastTopic ? streak + 1 : 1;
      if (wouldStreak <= PLAN_MAX_CONSECUTIVE_TOPIC) {
        if (idx === -1 || cand.gain > pool[idx]!.candidate.gain) idx = i;
      }
    }
    if (idx === -1) idx = 0; // degenerate: only capped-topic items remain
    out.push(pool.splice(idx, 1)[0]!);
  }
  return out;
}

/** Extend items / add filler so minutes sum exactly to the leftover. */
function fillRemainder(items: Selected[], leftover: number, fallbackTopicId: string | null): void {
  let remaining = leftover;
  while (remaining > 0) {
    // Prefer extending the highest-gain item that still has headroom.
    let bestIdx = -1;
    let bestGain = -1;
    for (let i = 0; i < items.length; i++) {
      const s = items[i]!;
      const headroom = PLAN_MAX_EXTEND_MINUTES - s.extended;
      if (headroom > 0 && s.candidate.gain > bestGain) {
        bestGain = s.candidate.gain;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0) {
      const s = items[bestIdx]!;
      const add = Math.min(remaining, PLAN_MAX_EXTEND_MINUTES - s.extended);
      s.extended += add;
      remaining -= add;
      continue;
    }
    // Filler review block chunked at 30 minutes.
    if (!fallbackTopicId) break;
    const chunk = Math.min(remaining, 30);
    items.push({
      candidate: {
        candidateId: `filler:${fallbackTopicId}:${items.length}`,
        topicId: fallbackTopicId,
        blockType: 'short_review',
        minutes: chunk,
        gain: 0,
        gainPerMinute: 0,
        priority: 0,
        difficultyBand: null,
        rationaleSeed: {
          accuracy: null,
          conceptualShare: 0,
          blueprintShare: 0,
          blueprintSource: 'none',
          daysLeft: 0,
          priority: 0,
          expectedGain: 0,
          wouldChangeIf: 'always — filler to reach the daily budget',
        },
      },
      extended: 0,
    });
    remaining -= chunk;
  }
}

export function plan(input: PlanInput): PlanOutput {
  const started = Date.now();
  const budgetMs = input.budgetMs ?? PLANNER_BUDGET_MS;
  const deadline = started + budgetMs;
  const candidates = input.candidates.slice(0, 200);
  const items: PlannedItem[] = [];
  const days: PlanDayResult[] = [];
  let usedFallback = input.forceFallback === true;

  input.days.forEach((day, dayIndex) => {
    const budget = Math.min(day.budgetMinutes, PLANNER_MAX_DAY_MINUTES);
    const pinned = (day.pinned ?? []).filter((p) => p.minutes > 0);
    const pinnedMinutes = pinned.reduce((a, p) => a + p.minutes, 0);
    const capacity = Math.max(0, budget - pinnedMinutes);

    let chosen: PlanCandidate[] = [];
    let method: 'knapsack' | 'fallback' = 'knapsack';
    if (!usedFallback && capacity > 0 && candidates.length > 0) {
      if (Date.now() >= deadline) {
        usedFallback = true;
        method = 'fallback';
      } else {
        chosen = knapsack(candidates, capacity);
      }
    }
    if (method === 'fallback' || usedFallback) {
      method = 'fallback';
      chosen = greedyFill(candidates, capacity);
    }

    const selected: Selected[] = chosen.map((c) => ({ candidate: c, extended: 0 }));
    const usedMinutes = selected.reduce((a, s) => a + s.candidate.minutes, 0);
    const leftover = capacity - usedMinutes;
    if (leftover > 0) {
      fillRemainder(selected, leftover, candidates[0]?.topicId ?? pinned[0]?.topicId ?? null);
    }

    const ordered = orderItems(selected);
    // Pinned first, then planned items; renumber from 1.
    let orderNo = 1;
    for (const p of pinned) {
      items.push({
        dayIndex,
        orderNo: orderNo++,
        blockType: p.blockType,
        topicId: p.topicId,
        minutes: p.minutes,
        pinned: true,
        difficultyBand: null,
        rationale: { ...(p.rationale ?? {}), pinned: true, blockType: p.blockType },
      });
    }
    let allocated = pinnedMinutes;
    for (const s of ordered) {
      const minutes = s.candidate.minutes + s.extended;
      allocated += minutes;
      items.push({
        dayIndex,
        orderNo: orderNo++,
        blockType: s.candidate.blockType,
        topicId: s.candidate.topicId,
        minutes,
        pinned: false,
        difficultyBand: s.candidate.difficultyBand,
        rationale: {
          ...s.candidate.rationaleSeed,
          blockType: s.candidate.blockType,
          minutes,
          dayIndex,
          date: day.date,
          extendedForBudget: s.extended,
        },
      });
    }
    days.push({
      dayIndex,
      date: day.date,
      budgetMinutes: budget,
      allocatedMinutes: allocated,
      plannerMethod: method,
    });
  });

  const elapsedMs = Date.now() - started;
  const plannerMethod =
    usedFallback || days.some((d) => d.plannerMethod === 'fallback') ? 'fallback' : 'knapsack';
  return { items, days, plannerMethod, elapsedMs };
}
