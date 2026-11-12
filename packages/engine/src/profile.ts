import {
  LABEL_STRONG_ABOVE,
  LABEL_WEAK_BELOW,
  THIN_EVIDENCE_MIN_ATTEMPTS,
  THIN_EVIDENCE_MIN_SESSIONS,
} from './config.js';
import { ratingPrior, updateRating, type RatingState } from './rating.js';
import { updateEma, type EmaState } from './ema.js';

/**
 * profileFromAttempts (PH6-T03) — folds a chronologically ordered attempt
 * list into per-topic states: rating + deviation, EMAs, attempt count,
 * reported vs observed error mix, label and thin-evidence flag.
 * Pure: no I/O, deterministic.
 */

export type ProfileLabel = 'weak' | 'moderate' | 'strong';

export interface ProfileAttemptInput {
  /** Question's taxonomy topic id. */
  topicId: string;
  /** Ordering key — ISO timestamp or sequence; attempts must be pre-sorted. */
  answeredAt: string;
  /** Session/context id used for the two-session evidence rule. */
  contextId: string;
  isCorrect: boolean | null;
  skipped: boolean;
  timeMs: number | null;
  expectedTimeMs: number | null;
  /** Question rating inputs for the Glicko update. */
  questionRating: number;
  questionRd: number;
  /** Reported error type code (student label), if any. */
  reportedErrorType: string | null;
  /** Inferred error type code (rule), if any. */
  inferredErrorType: string | null;
}

export interface TopicProfileState {
  topicId: string;
  rating: number;
  rd: number;
  /** Approximate 95% interval around the rating estimate. */
  intervalLow: number;
  intervalHigh: number;
  accuracyEma: number | null;
  timeEmaMs: number | null;
  attemptCount: number;
  /** Distinct contexts (sessions/diagnostics) contributing evidence. */
  sessionCount: number;
  /** Error mix: { reported: {type: n}, inferred: {type: n} }. */
  errorMix: { reported: Record<string, number>; inferred: Record<string, number> };
  label: ProfileLabel;
  /** Fewer than THIN_EVIDENCE_MIN_ATTEMPTS across < MIN_SESSIONS sessions. */
  thinEvidence: boolean;
}

export interface ProfileFromAttemptsResult {
  topics: TopicProfileState[];
  engineVersion: string;
}

const bump = (m: Record<string, number>, k: string | null) => {
  if (k) m[k] = (m[k] ?? 0) + 1;
};

export function labelFor(rating: number, rd: number): ProfileLabel {
  // Wide intervals stay 'moderate' — never claim weak/strong on priors.
  if (rd > 200) return 'moderate';
  if (rating < LABEL_WEAK_BELOW) return 'weak';
  if (rating > LABEL_STRONG_ABOVE) return 'strong';
  return 'moderate';
}

export function profileFromAttempts(
  attempts: readonly ProfileAttemptInput[],
): ProfileFromAttemptsResult {
  // Group by topic, preserving chronological order within each.
  const byTopic = new Map<string, ProfileAttemptInput[]>();
  for (const a of attempts) {
    const list = byTopic.get(a.topicId) ?? [];
    list.push(a);
    byTopic.set(a.topicId, list);
  }

  const topics: TopicProfileState[] = [];
  for (const [topicId, list] of byTopic) {
    const sorted = [...list].sort((x, y) => x.answeredAt.localeCompare(y.answeredAt));
    let rating: RatingState = ratingPrior();
    let ema: EmaState = { accuracyEma: null, timeEmaMs: null };
    const errorMix = {
      reported: {} as Record<string, number>,
      inferred: {} as Record<string, number>,
    };
    const contexts = new Set<string>();
    let answered = 0;

    for (const a of sorted) {
      contexts.add(a.contextId);
      bump(errorMix.reported, a.reportedErrorType);
      bump(errorMix.inferred, a.inferredErrorType);
      if (a.skipped || a.isCorrect == null) continue;
      answered += 1;
      const upd = updateRating(rating, a.questionRating, a.questionRd, a.isCorrect);
      rating = upd.state;
      ema = updateEma(ema, a.isCorrect ? 1 : 0, a.timeMs, a.expectedTimeMs).state;
    }

    // Interval: ±1.96·rd around the point estimate, floored at the prior.
    const intervalLow = Math.round((rating.rating - 1.96 * rating.rd) * 10) / 10;
    const intervalHigh = Math.round((rating.rating + 1.96 * rating.rd) * 10) / 10;

    topics.push({
      topicId,
      rating: rating.rating,
      rd: rating.rd,
      intervalLow,
      intervalHigh,
      accuracyEma: ema.accuracyEma,
      timeEmaMs: ema.timeEmaMs,
      attemptCount: answered,
      sessionCount: contexts.size,
      errorMix,
      label: labelFor(rating.rating, rating.rd),
      thinEvidence:
        answered < THIN_EVIDENCE_MIN_ATTEMPTS || contexts.size < THIN_EVIDENCE_MIN_SESSIONS,
    });
  }

  // Deterministic order for snapshots/tests.
  topics.sort((a, b) => a.topicId.localeCompare(b.topicId));
  return { topics, engineVersion: 'profile-v1' };
}
