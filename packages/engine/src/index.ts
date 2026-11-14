export const ENGINE_VERSION = '0.3.0';

/** Smoke function: proves the package is importable and pure. */
export function engineVersion(): string {
  return ENGINE_VERSION;
}

export {
  EngineError,
  markAttempt,
  parseNumericInput,
  type EngineErrorCode,
  type MarkingContext,
  type MarkingInput,
  type MarkingQuestion,
  type MarkingResult,
} from './marking.js';

export {
  inferError,
  type ErrorTypeCode,
  type InferErrorInput,
  type InferErrorResult,
} from './infer-error.js';

export {
  analyzeDiagnostic,
  type DiagnosticAttemptInput,
  type DiagnosticSummary,
  type TopicAccuracy,
  type BandAccuracy,
} from './diagnostic-analysis.js';

export {
  updateRating,
  expectedScore,
  ratingPrior,
  type RatingState,
  type RatingUpdate,
} from './rating.js';

export { updateEma, type EmaState, type EmaUpdate } from './ema.js';

export {
  profileFromAttempts,
  labelFor,
  type ProfileAttemptInput,
  type ProfileFromAttemptsResult,
  type ProfileLabel,
  type TopicProfileState,
} from './profile.js';

export * from './config.js';

export {
  priorities,
  proficiencyOf,
  conceptualShareOf,
  urgencyOf,
  targetProficiency,
  blendBlueprints,
  type BlueprintInput,
  type BlueprintWeightInput,
  type PriorityFactors,
  type PriorityTopicInput,
  type RequirementInput,
  type TopicPriority,
  type TargetInput,
  type BlendedTargetOutput,
} from './priority.js';

export {
  buildCandidates,
  blockTypeFor,
  type CandidateConstraints,
  type CandidateTopicInput,
  type PlanCandidate,
} from './candidates.js';

export {
  plan,
  type PinnedPlanItem,
  type PlanDayInput,
  type PlanDayResult,
  type PlanInput,
  type PlanOutput,
  type PlannedItem,
} from './planner.js';

export {
  readinessBand,
  type ReadinessBandResult,
  type ReadinessTopicInput,
  type ReadinessTopicOut,
} from './readiness.js';

export {
  evaluateCommitment,
  DEFAULT_COMMITMENT_CONFIG,
  type CommitmentConfig,
  type CommitmentEval,
  type CommitmentRow,
  type PracticeDay,
} from './commitments.js';
