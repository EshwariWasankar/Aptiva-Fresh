import { describe, expect, it } from 'vitest';
import { updateRating, ratingPrior } from '../src/rating.js';
import { updateEma } from '../src/ema.js';
import { profileFromAttempts } from '../src/profile.js';
import { RD_MIN, RATING_PRIOR } from '../src/config.js';

const Q = { rating: 1500, rd: 300 };

describe('updateRating (T-ML-01)', () => {
  it('correct answer raises rating, wrong lowers it', () => {
    const prior = ratingPrior();
    const win = updateRating(prior, Q.rating, Q.rd, true);
    const loss = updateRating(prior, Q.rating, Q.rd, false);
    expect(win.state.rating).toBeGreaterThan(RATING_PRIOR);
    expect(loss.state.rating).toBeLessThan(RATING_PRIOR);
  });

  it('RD never drops below the floor and shrinks with evidence', () => {
    let s = ratingPrior();
    for (let i = 0; i < 30; i++) s = updateRating(s, Q.rating, Q.rd, i % 3 !== 0).state;
    expect(s.rd).toBeGreaterThanOrEqual(RD_MIN);
    expect(s.rd).toBeLessThan(300);
  });

  it('rating step shrinks as RD falls', () => {
    const fresh = updateRating(ratingPrior(), Q.rating, Q.rd, true);
    const experienced = updateRating({ rating: 1600, rd: 60 }, Q.rating, Q.rd, true);
    expect(Math.abs(experienced.state.rating - 1600)).toBeLessThan(
      Math.abs(fresh.state.rating - RATING_PRIOR),
    );
  });
});

describe('updateEma (T-ML-02)', () => {
  it('first value initialises; later values follow the weight', () => {
    const first = updateEma({ accuracyEma: null, timeEmaMs: null }, 1, 60_000, 60_000);
    expect(first.state.accuracyEma).toBe(1);
    expect(first.state.timeEmaMs).toBe(60_000);
    const second = updateEma(first.state, 0, 30_000, 60_000);
    expect(second.state.accuracyEma).toBeCloseTo(0.7, 5); // 0.3*0 + 0.7*1
    expect(second.state.timeEmaMs).toBeCloseTo(0.3 * 30_000 + 0.7 * 60_000, 0);
    expect(second.paceRatio).toBeCloseTo(0.5, 5);
  });
});

describe('profileFromAttempts', () => {
  const mk = (over: Partial<Parameters<typeof profileFromAttempts>[0][number]> = {}) => ({
    topicId: 't1',
    answeredAt: '2026-01-01T00:00:00Z',
    contextId: 'c1',
    isCorrect: true,
    skipped: false,
    timeMs: 30_000,
    expectedTimeMs: 60_000,
    questionRating: 1500,
    questionRd: 300,
    reportedErrorType: null,
    inferredErrorType: null,
    ...over,
  });

  it('aggregates per topic with error mix and thin-evidence flag', () => {
    const res = profileFromAttempts([
      mk({ isCorrect: false, reportedErrorType: 'calculation', inferredErrorType: 'calculation' }),
      mk({ answeredAt: '2026-01-01T00:01:00Z', contextId: 'c2' }),
      mk({ answeredAt: '2026-01-01T00:02:00Z', contextId: 'c2', skipped: true, isCorrect: null }),
    ]);
    expect(res.topics).toHaveLength(1);
    const t = res.topics[0]!;
    expect(t.attemptCount).toBe(2); // skipped not counted
    expect(t.sessionCount).toBe(2);
    expect(t.errorMix.reported.calculation).toBe(1);
    expect(t.thinEvidence).toBe(true); // < 15 attempts
    expect(t.intervalHigh).toBeGreaterThan(t.rating);
    expect(t.intervalLow).toBeLessThan(t.rating);
  });
});
