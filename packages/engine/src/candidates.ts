import {
  BLOCK_TYPE_EFFICIENCY,
  BLOCK_TYPE_MINUTES,
  CONCEPT_REPAIR_ERROR_SHARE,
  FORMULA_REVISION_ERROR_SHARE,
  PLAN_MIN_ITEM_MINUTES,
  WEAK_ACCURACY_EGA,
  type BlockType,
} from './config.js';
import { conceptualShareOf, type TopicPriority } from './priority.js';

/**
 * buildCandidates (PH7-T04) — turns topic priorities into concrete block
 * candidates with minutes, expected gain and a block type. Pure.
 *
 * Block-type rules (playbook PH-7 notes):
 * - thin evidence            → probe
 * - strong + sufficient      → maintenance
 * - high conceptual share    → concept_repair (only when a reviewed lesson exists)
 * - high formula share       → formula_revision
 * - weak accuracy            → timed_set
 * - otherwise                → targeted_practice
 */

export interface CandidateTopicInput {
  /** Full priority row (already computed). */
  priority: TopicPriority;
  accuracyEma: number | null;
  /** errorMix for formula/concept split. */
  errorMix: { reported: Record<string, number>; inferred: Record<string, number> };
  /** Estimated current difficulty band (1..3), when known. */
  difficultyBand: number | null;
}

export interface CandidateConstraints {
  /** Topic ids that have at least one reviewed lesson (concept_repair gate). */
  topicsWithLessons: ReadonlySet<string>;
}

export interface PlanCandidate {
  /** Stable id: `${topicId}:${blockType}`. */
  candidateId: string;
  topicId: string;
  blockType: BlockType;
  minutes: number;
  /** Expected gain = priority × minutes × block-type efficiency. */
  gain: number;
  /** gain / minutes — the knapsack value density. */
  gainPerMinute: number;
  priority: number;
  difficultyBand: number | null;
  rationaleSeed: {
    accuracy: number | null;
    conceptualShare: number;
    blueprintShare: number;
    blueprintSource: string;
    daysLeft: number;
    priority: number;
    expectedGain: number;
    wouldChangeIf: string;
  };
}

function formulaShareOf(errorMix: {
  reported: Record<string, number>;
  inferred: Record<string, number>;
}): number {
  const all = { ...errorMix.reported, ...errorMix.inferred };
  const total = Object.values(all).reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  const formula = (all['formula'] ?? 0) + (all['units_rounding'] ?? 0);
  return formula / total;
}

const CRAM_BLOCK_TYPES: ReadonlySet<BlockType> = new Set([
  'speed_drill',
  'formula_revision',
  'short_review',
  'timed_set',
  'mixed_check',
  'maintenance',
  'probe',
]);

export function blockTypeFor(
  p: TopicPriority,
  input: CandidateTopicInput,
  constraints: CandidateConstraints,
  cram = false,
): BlockType {
  if (p.maintenance) return 'maintenance';
  if (p.thinEvidence) return 'probe';
  const conceptual = conceptualShareOf(input.errorMix);
  const formula = formulaShareOf(input.errorMix);
  if (!cram) {
    if (conceptual >= CONCEPT_REPAIR_ERROR_SHARE && constraints.topicsWithLessons.has(p.topicId)) {
      return 'concept_repair';
    }
    if (formula >= FORMULA_REVISION_ERROR_SHARE) return 'formula_revision';
  } else if (formula >= FORMULA_REVISION_ERROR_SHARE) {
    return 'formula_revision';
  }
  if ((input.accuracyEma ?? 1) < WEAK_ACCURACY_EGA) return 'timed_set';
  // Cram mode (PH9-T05, last 48h): no new heavy concepts — drills and
  // revision only, chosen from the allowed set deterministically.
  if (cram) {
    const pick =
      input.accuracyEma != null && input.accuracyEma >= 0.7 ? 'speed_drill' : 'mixed_check';
    return CRAM_BLOCK_TYPES.has(pick) ? pick : 'mixed_check';
  }
  return 'targeted_practice';
}

export function buildCandidates(
  inputs: readonly CandidateTopicInput[],
  constraints: CandidateConstraints,
  ctx: { blueprintSource: string; daysLeft: number; cram?: boolean },
): PlanCandidate[] {
  const out: PlanCandidate[] = [];
  for (const input of inputs) {
    const p = input.priority;
    // Zero-priority non-maintenance topics get no candidate.
    if (p.priority <= 0 && !p.maintenance) continue;
    const blockType = blockTypeFor(p, input, constraints, ctx.cram === true);
    const base = BLOCK_TYPE_MINUTES[blockType];
    const minutes = Math.max(PLAN_MIN_ITEM_MINUTES, Math.round(base / 5) * 5);
    const efficiency = BLOCK_TYPE_EFFICIENCY[blockType];
    const gain = p.priority * minutes * efficiency;
    const conceptualShare = conceptualShareOf(input.errorMix);
    out.push({
      candidateId: `${p.topicId}:${blockType}`,
      topicId: p.topicId,
      blockType,
      minutes,
      gain: Math.round(gain * 1e6) / 1e6,
      gainPerMinute: Math.round((gain / minutes) * 1e6) / 1e6,
      priority: p.priority,
      difficultyBand: input.difficultyBand,
      rationaleSeed: {
        accuracy: input.accuracyEma,
        conceptualShare: Math.round(conceptualShare * 1000) / 1000,
        blueprintShare: p.blueprintShare,
        blueprintSource: ctx.blueprintSource,
        daysLeft: ctx.daysLeft,
        priority: p.priority,
        expectedGain: Math.round(gain * 100) / 100,
        wouldChangeIf: 'accuracy at pace reaches the target band, or blueprint relevance changes',
      },
    });
  }
  // Deterministic candidate order: gain desc, then candidateId.
  out.sort((a, b) => b.gain - a.gain || a.candidateId.localeCompare(b.candidateId));
  return out.slice(0, 200);
}
