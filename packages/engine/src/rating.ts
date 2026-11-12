import { GLICKO_SCALE, QUESTION_RD_FALLBACK, RD_MIN, RD_PRIOR, RATING_PRIOR } from './config.js';

/**
 * Glicko-1-style online rating (PH6-T02, T-ML-01).
 * The student topic state plays one game against the question, treated as
 * an opponent at the question's own rating/deviation. One update per
 * attempt; the rating swing is proportional to RD² so steps shrink as
 * evidence accumulates.
 */

export interface RatingState {
  rating: number;
  rd: number;
}

export interface RatingUpdate {
  state: RatingState;
  /** Expected score before the update (for logging/tests). */
  expected: number;
}

const LN10_OVER_400 = Math.LN10 / GLICKO_SCALE; // Glicko q factor

/** g(RD): Glicko-1 scaling of the opponent deviation (rating units). */
function g(rd: number): number {
  return 1 / Math.sqrt(1 + (3 * rd * rd) / (Math.PI * Math.PI * GLICKO_SCALE * GLICKO_SCALE));
}

export function expectedScore(
  student: RatingState,
  questionRating: number,
  questionRd: number,
): number {
  return (
    1 / (1 + Math.pow(10, (-g(questionRd) * (student.rating - questionRating)) / GLICKO_SCALE))
  );
}

/**
 * Update a topic rating after one attempt.
 * Call only for answered (non-skipped) attempts.
 */
export function updateRating(
  state: RatingState,
  questionRating: number,
  questionRd: number,
  correct: boolean,
): RatingUpdate {
  const rdJ = questionRd > 0 ? questionRd : QUESTION_RD_FALLBACK;
  const gj = g(rdJ);
  const expected = expectedScore(state, questionRating, rdJ);
  const score = correct ? 1 : 0;

  // Glicko-1 update: performance variance d² then posterior RD and rating.
  const e = Math.min(Math.max(expected, 1e-6), 1 - 1e-6);
  const d2 = 1 / (LN10_OVER_400 * LN10_OVER_400 * gj * gj * e * (1 - e));
  const newRd = Math.min(Math.sqrt(1 / (1 / (state.rd * state.rd) + 1 / d2)), RD_PRIOR * 2);
  const delta = newRd * newRd * LN10_OVER_400 * gj * (score - expected);
  const newRating = state.rating + delta;

  return {
    state: {
      rating: Math.round(newRating * 100) / 100,
      rd: Math.max(RD_MIN, Math.round(newRd * 100) / 100),
    },
    expected: Math.round(expected * 10000) / 10000,
  };
}

/** Fresh prior state. */
export function ratingPrior(): RatingState {
  return { rating: RATING_PRIOR, rd: RD_PRIOR };
}
