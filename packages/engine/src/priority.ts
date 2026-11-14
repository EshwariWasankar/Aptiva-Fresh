import {
  BLUEPRINT_WEIGHT_MIN,
  PROFILE_TOPIC_SHARE_NORM_FLOOR,
  ERROR_PRESSURE_MAX,
  THIN_EVIDENCE_PRIORITY_FACTOR,
  URGENCY_FLOOR_DAYS,
  URGENCY_FULL_DAYS,
  URGENCY_MAX,
  URGENCY_MIN,
  WANTED_TOPIC_WEIGHT_FLOOR,
} from './config.js';

/**
 * priorities (PH7-T04) — per-topic priority score from profile state,
 * blueprint weights and days-left urgency. Pure and deterministic.
 *
 * priority = gapNorm × blueprintRelevance × urgency × errorPressure × evidenceFactor
 * - gapNorm is max(0, target − proficiency)/50 → gap 0 ⇒ priority 0 (T-ML-05)
 * - every factor is in [0, ~1.5]; priority is monotone in gap.
 */

export interface PriorityTopicInput {
  topicId: string;
  slug: string;
  /** Current rating estimate (1500 prior). */
  rating: number;
  rd: number;
  attemptCount: number;
  accuracyEma: number | null;
  /** errorMix.inferred counts (observed) and .reported counts. */
  errorMix: { reported: Record<string, number>; inferred: Record<string, number> };
  /** True when attemptCount < thin-evidence threshold. */
  thinEvidence: boolean;
  label: 'weak' | 'moderate' | 'strong';
}

export interface BlueprintWeightInput {
  topicId: string;
  /** Share of the blueprint's total weight for this topic (0..1). */
  share: number;
  difficultyBand: number | null;
  paceSeconds: number | null;
  /** Root section slug for the topic, when known. */
  sectionSlug: string | null;
}

export interface BlueprintInput {
  slug: string;
  sourceType: string;
  confidence: string;
  negativeMarking: number | null;
  weights: BlueprintWeightInput[];
}

export interface RequirementInput {
  testDate: string; // ISO date
  deadlineDate: string;
  /** Days until deadline (computed by caller; >= 0). */
  daysLeft: number;
  wantedTopics: string[];
}

export interface PriorityFactors {
  gap: number;
  targetProficiency: number;
  proficiency: number;
  blueprintShare: number;
  blueprintWeight: number;
  urgency: number;
  errorPressure: number;
  conceptualShare: number;
  evidenceFactor: number;
}

export interface TopicPriority {
  topicId: string;
  slug: string;
  priority: number;
  factors: PriorityFactors;
  /** Blueprint share for this topic (0 when absent from blueprint). */
  blueprintShare: number;
  /** True for thin-evidence topics — always get a probe candidate. */
  thinEvidence: boolean;
  label: 'weak' | 'moderate' | 'strong';
  /** True when the topic is strong and not thin — maintenance candidate. */
  maintenance: boolean;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** rating → proficiency 0..100 (1500 → 50). */
export function proficiencyOf(rating: number): number {
  return clamp01((rating - 1000) / 1000) * 100;
}

/** Conceptual share of the combined reported+inferred error mix. */
export function conceptualShareOf(errorMix: {
  reported: Record<string, number>;
  inferred: Record<string, number>;
}): number {
  const all = { ...errorMix.reported, ...errorMix.inferred };
  const total = Object.values(all).reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  const conceptual =
    (all['concept'] ?? 0) +
    (all['underprepared'] ?? 0) +
    (all['application'] ?? 0) +
    (all['conceptual_gap'] ?? 0);
  return conceptual / total;
}

export function urgencyOf(daysLeft: number): number {
  if (daysLeft <= URGENCY_FULL_DAYS) return URGENCY_MAX;
  if (daysLeft >= URGENCY_FLOOR_DAYS) return URGENCY_MIN;
  const t = (daysLeft - URGENCY_FULL_DAYS) / (URGENCY_FLOOR_DAYS - URGENCY_FULL_DAYS);
  return URGENCY_MAX - t * (URGENCY_MAX - URGENCY_MIN);
}

/**
 * Target proficiency per topic: higher blueprint share ⇒ higher target.
 * shareNorm is share / maxShare across the blueprint's weights.
 */
export function targetProficiency(shareNorm: number): number {
  const t = 35 + shareNorm * 50; // 35..85, documented in config notes
  return Math.min(85, Math.max(35, t));
}

export function priorities(
  topics: readonly PriorityTopicInput[],
  blueprint: BlueprintInput,
  requirement: RequirementInput,
): TopicPriority[] {
  const weights = new Map(blueprint.weights.map((w) => [w.topicId, w]));
  const maxShare = Math.max(0, ...blueprint.weights.map((w) => w.share));
  const wanted = new Set(requirement.wantedTopics);
  const urgency = urgencyOf(requirement.daysLeft);

  // Union of profile topics and blueprint-weighted topics.
  const ids = new Set<string>([
    ...topics.map((t) => t.topicId),
    ...blueprint.weights.map((w) => w.topicId),
    ...wanted,
  ]);
  const byId = new Map(topics.map((t) => [t.topicId, t]));

  const out: TopicPriority[] = [];
  for (const topicId of ids) {
    const t = byId.get(topicId);
    const w = weights.get(topicId);
    const share = w?.share ?? 0;
    const shareNorm = maxShare > 0 ? share / maxShare : 0;
    const wantedBoost = wanted.has(topicId) && shareNorm === 0 ? WANTED_TOPIC_WEIGHT_FLOOR : 0;
    // Profiled topics outside the blueprint keep a baseline share — a
    // student's measured weaknesses must never be invisible to the plan.
    const profileFloor =
      t !== undefined && shareNorm === 0 && wantedBoost === 0 ? PROFILE_TOPIC_SHARE_NORM_FLOOR : 0;
    const effectiveShareNorm = Math.max(shareNorm, wantedBoost, profileFloor);

    const rating = t?.rating ?? 1500;
    const proficiency = proficiencyOf(rating);
    const target = targetProficiency(effectiveShareNorm);
    const gap = Math.max(0, target - proficiency);
    const gapNorm = gap / 50;

    const blueprintWeight = BLUEPRINT_WEIGHT_MIN + (1 - BLUEPRINT_WEIGHT_MIN) * effectiveShareNorm;
    const conceptualShare = t ? conceptualShareOf(t.errorMix) : 0;
    // errorPressure factor reported as the 0..1 conceptual share; the
    // (1 + ERROR_PRESSURE_MAX * share) multiplier is applied in the product.
    const errorPressure = conceptualShare;
    const evidenceFactor = t?.thinEvidence ? THIN_EVIDENCE_PRIORITY_FACTOR : 1;

    const priority =
      gapNorm *
      blueprintWeight *
      urgency *
      (1 + ERROR_PRESSURE_MAX * conceptualShare) *
      evidenceFactor;

    const maintenance = !t?.thinEvidence && t?.label === 'strong' && gap === 0;

    out.push({
      topicId,
      slug: t?.slug ?? w?.topicId ?? topicId,
      priority: Math.round(priority * 1e6) / 1e6,
      factors: {
        gap: Math.round((gap / 50) * 1000) / 1000,
        targetProficiency: Math.round((target / 100) * 1000) / 1000,
        proficiency: Math.round((proficiency / 100) * 1000) / 1000,
        blueprintShare: share,
        blueprintWeight: Math.round(blueprintWeight * 1000) / 1000,
        urgency: Math.round(urgency * 1000) / 1000,
        errorPressure: Math.round(errorPressure * 1000) / 1000,
        conceptualShare: Math.round(conceptualShare * 1000) / 1000,
        evidenceFactor,
      },
      blueprintShare: share,
      thinEvidence: t?.thinEvidence ?? true,
      label: t?.label ?? 'moderate',
      maintenance,
    });
  }

  // Deterministic order: priority desc, then topicId.
  out.sort((a, b) => b.priority - a.priority || a.topicId.localeCompare(b.topicId));
  return out;
}

export interface TargetInput {
  company: string;
  targetDate: string;
  daysLeft: number;
  weight: number;
  blueprint: BlueprintInput;
}

export interface BlendedTargetOutput {
  blueprint: BlueprintInput;
  effectiveDaysLeft: number;
  targetCount: number;
}

/**
 * Blends multiple company blueprints by date and priority split (FR-022, PH13-T03).
 * Produces one coherent blueprint with combined topic weights and effective urgency horizon.
 */
export function blendBlueprints(targets: TargetInput[]): BlendedTargetOutput {
  if (targets.length === 0) {
    throw new Error('At least one target is required to blend blueprints');
  }
  if (targets.length === 1) {
    const first = targets[0]!;
    return {
      blueprint: first.blueprint,
      effectiveDaysLeft: first.daysLeft,
      targetCount: 1,
    };
  }

  const totalRawWeight = targets.reduce((sum, t) => sum + Math.max(0.01, t.weight), 0);
  const normalizedTargets = targets.map((t) => ({
    ...t,
    normWeight: Math.max(0.01, t.weight) / totalRawWeight,
  }));

  // Effective days left is the min days left with weight adjustment
  const effectiveDaysLeft = Math.max(
    0,
    Math.round(normalizedTargets.reduce((acc, t) => acc + t.daysLeft * t.normWeight, 0)),
  );

  const topicMap = new Map<
    string,
    {
      topicId: string;
      share: number;
      difficultyBandSum: number;
      paceSecondsSum: number;
      weightCount: number;
      sectionSlug: string | null;
    }
  >();

  for (const t of normalizedTargets) {
    for (const w of t.blueprint.weights) {
      const existing = topicMap.get(w.topicId);
      const blendedShare = w.share * t.normWeight;
      if (existing) {
        existing.share += blendedShare;
        if (w.difficultyBand != null) existing.difficultyBandSum += w.difficultyBand * t.normWeight;
        if (w.paceSeconds != null) existing.paceSecondsSum += w.paceSeconds * t.normWeight;
        existing.weightCount += t.normWeight;
        if (!existing.sectionSlug && w.sectionSlug) existing.sectionSlug = w.sectionSlug;
      } else {
        topicMap.set(w.topicId, {
          topicId: w.topicId,
          share: blendedShare,
          difficultyBandSum: w.difficultyBand != null ? w.difficultyBand * t.normWeight : 0,
          paceSecondsSum: w.paceSeconds != null ? w.paceSeconds * t.normWeight : 0,
          weightCount: t.normWeight,
          sectionSlug: w.sectionSlug,
        });
      }
    }
  }

  // Normalize shares so sum of shares is 1.0 (or total blended share)
  const totalBlendedShare = Array.from(topicMap.values()).reduce(
    (sum, item) => sum + item.share,
    0,
  );
  const weights: BlueprintWeightInput[] = Array.from(topicMap.values()).map((item) => ({
    topicId: item.topicId,
    share: totalBlendedShare > 0 ? item.share / totalBlendedShare : item.share,
    difficultyBand:
      item.weightCount > 0 ? Math.round(item.difficultyBandSum / item.weightCount) : null,
    paceSeconds: item.weightCount > 0 ? Math.round(item.paceSecondsSum / item.weightCount) : null,
    sectionSlug: item.sectionSlug,
  }));

  const blendedSlug = `blended-${targets.map((t) => t.company.toLowerCase().replace(/\s+/g, '-')).join('-')}`;

  return {
    blueprint: {
      slug: blendedSlug,
      sourceType: 'blended_multi_target',
      confidence: 'medium',
      negativeMarking: targets[0]?.blueprint.negativeMarking ?? null,
      weights,
    },
    effectiveDaysLeft,
    targetCount: targets.length,
  };
}
