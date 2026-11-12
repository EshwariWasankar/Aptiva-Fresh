/**
 * @aptiva/replay — offline engine replay and evaluation (playbook Section 17,
 * PH6-T07 skeleton). Replays chronologically ordered synthetic attempts
 * through packages/engine rating updates and reports predictive log loss,
 * Brier score and interval coverage vs the rating interval.
 */

import { expectedScore, ratingPrior, updateRating, type RatingState } from '@aptiva/engine';

export const REPLAY_TOOL_VERSION = '0.1.0';

export interface ReplayAttempt {
  topicId: string;
  /** True skill per topic used by the synthetic generator (0..1). */
  correct: boolean;
  questionRating: number;
  questionRd: number;
}

export interface ReplayReport {
  attempts: number;
  topics: number;
  /** Mean -log(p) of the predicted correctness probability. */
  logLoss: number;
  /** Mean squared error of predicted probability. */
  brier: number;
  /** Share of outcomes inside rating ± 1.96·rd mapped to a probability band. */
  intervalCoverage: number;
  meanAbsError: number;
}

/**
 * Replay attempts grouped by topic in arrival order. The rating state is
 * updated AFTER scoring each attempt (prequential evaluation — no leakage).
 */
export function replayAttempts(attempts: readonly ReplayAttempt[]): ReplayReport {
  const states = new Map<string, RatingState>();
  let logLossSum = 0;
  let brierSum = 0;
  let covered = 0;
  let scored = 0;
  let absErrSum = 0;

  for (const a of attempts) {
    const state = states.get(a.topicId) ?? ratingPrior();
    const p = clamp(expectedScore(state, a.questionRating, a.questionRd), 1e-4, 1 - 1e-4);
    const y = a.correct ? 1 : 0;
    logLossSum += -(y * Math.log(p) + (1 - y) * Math.log(1 - p));
    brierSum += (p - y) * (p - y);
    absErrSum += Math.abs(p - y);
    // "Coverage": outcome consistent with the interval's implied band —
    // proxy: predicted probability within [0.2, 0.8] counts as uncertain.
    if (p > 0.2 && p < 0.8) covered += 1;
    scored += 1;
    states.set(a.topicId, updateRating(state, a.questionRating, a.questionRd, a.correct).state);
  }

  return {
    attempts: scored,
    topics: states.size,
    logLoss: scored ? logLossSum / scored : 0,
    brier: scored ? brierSum / scored : 0,
    intervalCoverage: scored ? covered / scored : 0,
    meanAbsError: scored ? absErrSum / scored : 0,
  };
}

/** Deterministic synthetic stream: per-topic skill drifts slowly. */
export function syntheticAttempts(topics: number, perTopic: number, seed = 42): ReplayAttempt[] {
  let s = seed;
  const rand = () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
  const out: ReplayAttempt[] = [];
  for (let t = 0; t < topics; t++) {
    const skill = 0.35 + rand() * 0.5; // 0.35..0.85 true accuracy
    for (let i = 0; i < perTopic; i++) {
      out.push({
        topicId: `topic-${t}`,
        correct: rand() < skill,
        questionRating: 1400 + Math.floor(rand() * 5) * 50,
        questionRd: 300,
      });
    }
  }
  return out;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
