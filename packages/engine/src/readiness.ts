import {
  READINESS_CONFIDENCE_HIGH,
  READINESS_CONFIDENCE_MEDIUM,
  READINESS_PACE_PENALTY_RATE,
  READINESS_PACE_PENALTY_START,
  READINESS_P_MAX,
  READINESS_P_MIN,
  READINESS_UNCERTAINTY_PER_RD,
  THIN_EVIDENCE_MIN_ATTEMPTS,
} from './config.js';
import { proficiencyOf } from './priority.js';
import type { BlueprintInput } from './priority.js';

/**
 * readinessBand (PH7-T04/E-036) — weighted simulation: for each blueprint
 * topic, probability of answering correctly at the student's pace, then a
 * share-weighted band with a confidence badge. Never a bare number.
 * Pure.
 */

export interface ReadinessTopicInput {
  topicId: string;
  rating: number;
  rd: number;
  attemptCount: number;
  /** timeEmaMs / expectedMs pace ratio, when known. */
  paceRatio: number | null;
  thinEvidence: boolean;
}

export interface ReadinessTopicOut {
  topicId: string;
  share: number;
  rating: number;
  rd: number;
  nEff: number;
  paceRatio: number | null;
  /** Probability correct at pace, 0..1. */
  p: number;
}

export interface ReadinessBandResult {
  /** Weighted expected score, 0..1. */
  expected: number;
  bandLow: number;
  bandHigh: number;
  /** 0..1 — display as a percentage band. */
  confidence: 'low' | 'medium' | 'high';
  blueprintSlug: string;
  blueprintSourceType: string;
  blueprintConfidence: string;
  negativeMarking: number | null;
  topics: ReadinessTopicOut[];
  engineVersion: string;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function readinessBand(
  topics: readonly ReadinessTopicInput[],
  blueprint: BlueprintInput,
  engineVersion: string,
): ReadinessBandResult {
  const byId = new Map(topics.map((t) => [t.topicId, t]));
  const totalShare = blueprint.weights.reduce((a, w) => a + w.share, 0) || 1;

  const out: ReadinessTopicOut[] = [];
  let expected = 0;
  let uncertainty = 0;
  let evidenceCoverage = 0;

  for (const w of blueprint.weights) {
    const t = byId.get(w.topicId);
    const rating = t?.rating ?? 1500;
    const rd = t?.rd ?? 300;
    const attemptCount = t?.attemptCount ?? 0;
    const paceRatio = t?.paceRatio ?? null;

    const proficiency = proficiencyOf(rating); // 0..100
    // p = base from proficiency, penalised when pace is slower than expected.
    let p = 0.05 + 0.9 * (proficiency / 100);
    if (paceRatio !== null && paceRatio > READINESS_PACE_PENALTY_START) {
      p -= READINESS_PACE_PENALTY_RATE * (paceRatio - READINESS_PACE_PENALTY_START);
    }
    p = clamp(p, READINESS_P_MIN, READINESS_P_MAX);

    const share = w.share / totalShare;
    expected += share * p;
    uncertainty += share * (rd / 300) * READINESS_UNCERTAINTY_PER_RD;
    const covered =
      attemptCount >= THIN_EVIDENCE_MIN_ATTEMPTS ? 1 : attemptCount / THIN_EVIDENCE_MIN_ATTEMPTS;
    evidenceCoverage += share * covered;

    out.push({
      topicId: w.topicId,
      share: Math.round(share * 1000) / 1000,
      rating,
      rd,
      nEff: attemptCount,
      paceRatio,
      p: Math.round(p * 1000) / 1000,
    });
  }

  const bandLow = clamp(expected - uncertainty, 0, 1);
  const bandHigh = clamp(expected + uncertainty, 0, 1);
  const confidence =
    evidenceCoverage >= READINESS_CONFIDENCE_HIGH
      ? 'high'
      : evidenceCoverage >= READINESS_CONFIDENCE_MEDIUM
        ? 'medium'
        : 'low';

  return {
    expected: Math.round(expected * 1000) / 1000,
    bandLow: Math.round(bandLow * 1000) / 1000,
    bandHigh: Math.round(bandHigh * 1000) / 1000,
    confidence,
    blueprintSlug: blueprint.slug,
    blueprintSourceType: blueprint.sourceType,
    blueprintConfidence: blueprint.confidence,
    negativeMarking: blueprint.negativeMarking,
    topics: out,
    engineVersion,
  };
}
