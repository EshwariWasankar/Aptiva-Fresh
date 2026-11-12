/**
 * Engine tunables (PH6-T02). Every magic number lives here with a note.
 * Formulas are Glicko-2-inspired rating + EMA per playbook Section 17;
 * the "first Implementation Guide Section 6" constants are approximated
 * and marked [P] where the playbook leaves them open.
 */

/** Prior rating for a topic with no evidence (matches Section 8.8 default). */
export const RATING_PRIOR = 1500;
/** Prior rating deviation — wide until evidence accumulates. */
export const RD_PRIOR = 300;
/** Floor for rating deviation — never fully certain. */
export const RD_MIN = 30;
/** Scale factor converting rating difference to expected score. */
export const GLICKO_SCALE = 400;
/** Question-side fixed RD used when a question has too few responses. */
export const QUESTION_RD_FALLBACK = 300;
/** Minimum responses before a question's own rating is updated (PH6-T06). */
export const QUESTION_RATING_MIN_RESPONSES = 30;
/** K-factor analogue: max rating swing per attempt at low evidence. */
export const RATING_K = 32;
/** EMA weight for new observations (accuracy and time). */
export const EMA_ALPHA = 0.3;
/** Thin-evidence threshold: attempts needed for a non-early estimate. */
export const THIN_EVIDENCE_MIN_ATTEMPTS = 15;
/** Thin-evidence also requires attempts from at least two sessions. */
export const THIN_EVIDENCE_MIN_SESSIONS = 2;
/** Label thresholds on the rating estimate (Weak / Moderate / Strong). */
export const LABEL_WEAK_BELOW = 1350;
export const LABEL_STRONG_ABOVE = 1650;

// ----------------------------------------------------------------- PH-7 planner

/** Rating → proficiency (0..100): 1500 prior maps to 50. */
export const PROFICIENCY_AT_PRIOR = 50;
export const PROFICIENCY_PER_100_RATING = 10; // (rating-1000)/10 → 1000→0, 2000→100
/** Target proficiency for a blueprint topic at shareNorm=1. */
export const TARGET_PROFICIENCY_MAX = 85;
/** Target proficiency floor for any blueprint topic. */
export const TARGET_PROFICIENCY_MIN = 35;
/** Blueprint relevance weight range: shareNorm 0 → 0.4, 1 → 1.0. */
export const BLUEPRINT_WEIGHT_MIN = 0.4;
/** Urgency: days-left curve. Full boost inside 14 days, decays to floor by 42. */
export const URGENCY_FULL_DAYS = 14;
export const URGENCY_FLOOR_DAYS = 42;
export const URGENCY_MIN = 0.4;
export const URGENCY_MAX = 1.0;
/** Conceptual-error share adds up to +50% priority. */
export const ERROR_PRESSURE_MAX = 0.5;
/** Thin-evidence topics are deprioritised but always get a probe candidate. */
export const THIN_EVIDENCE_PRIORITY_FACTOR = 0.7;
/** Wanted topics get at least this blueprint weight even outside the blueprint. */
export const WANTED_TOPIC_WEIGHT_FLOOR = 0.5;
/** Profiled topics absent from the blueprint still get a baseline share so
 *  diagnostic weaknesses are never invisible to the planner. */
export const PROFILE_TOPIC_SHARE_NORM_FLOOR = 0.5;

// Candidate block types and base durations (minutes).
export const BLOCK_TYPE_MINUTES = {
  concept_repair: 15,
  targeted_practice: 20,
  timed_set: 25,
  formula_revision: 15,
  mixed_check: 20,
  speed_drill: 15,
  short_review: 10,
  maintenance: 8,
  probe: 10,
} as const;
export type BlockType = keyof typeof BLOCK_TYPE_MINUTES;
/** Gain-per-minute efficiency per block type. */
export const BLOCK_TYPE_EFFICIENCY = {
  concept_repair: 1.2,
  targeted_practice: 1.0,
  timed_set: 0.9,
  formula_revision: 1.1,
  mixed_check: 0.9,
  speed_drill: 1.0,
  short_review: 0.8,
  maintenance: 0.5,
  probe: 0.7,
} as const;
/** Planner hard limits (playbook 19). */
export const PLANNER_MAX_CANDIDATES = 200;
export const PLANNER_MAX_DAY_MINUTES = 240;
export const PLANNER_BUDGET_MS = 250;
export const PLANNER_FALLBACK_TOTAL_MS = 300;
/** Knapsack fill granularity for the exact-sum repair. */
export const PLAN_MIN_ITEM_MINUTES = 5;
/** Max minutes a single plan item may be extended by for exact-sum. */
export const PLAN_MAX_EXTEND_MINUTES = 15;
/** Max consecutive blocks from one topic in a day. */
export const PLAN_MAX_CONSECUTIVE_TOPIC = 2;
/** Conceptual error share that triggers concept_repair over practice. */
export const CONCEPT_REPAIR_ERROR_SHARE = 0.4;
/** Formula/recall error share that triggers formula_revision. */
export const FORMULA_REVISION_ERROR_SHARE = 0.3;
/** Accuracy EMA below this marks a topic weak for block selection. */
export const WEAK_ACCURACY_EGA = 0.55;
/** Readiness: per-topic correct-at-pace probability clamps. */
export const READINESS_P_MIN = 0.02;
export const READINESS_P_MAX = 0.98;
/** Readiness band half-width per unit of mean RD/300. */
export const READINESS_UNCERTAINTY_PER_RD = 0.25;
/** Pace ratio above which readiness probability is penalised. */
export const READINESS_PACE_PENALTY_START = 1.2;
export const READINESS_PACE_PENALTY_RATE = 0.15;
/** Confidence thresholds on share-weighted evidence coverage. */
export const READINESS_CONFIDENCE_HIGH = 0.8;
export const READINESS_CONFIDENCE_MEDIUM = 0.5;
