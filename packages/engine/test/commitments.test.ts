import { describe, expect, it } from 'vitest';
import { evaluateCommitment, type CommitmentRow, type PracticeDay } from '../src/commitments.js';

describe('evaluateCommitment', () => {
  it('evaluates minutes target correctly', () => {
    const commitment: CommitmentRow = {
      type: 'minutes',
      target: 60,
      startDate: '2026-11-10',
    };
    const days: PracticeDay[] = [
      { date: '2026-11-10', activeSeconds: 1200, questionsAnswered: 15 },
      { date: '2026-11-11', activeSeconds: 1500, questionsAnswered: 20 },
    ];
    // 2700 sec = 45 minutes
    const res = evaluateCommitment(commitment, days, '2026-11-11');
    expect(res.status).toBe('active');
    expect(res.minutesDone).toBe(45);
    expect(res.text).toBe('45 of 60 minutes done.');

    // Add another 1000 sec => 3700 sec = 61 min => completed
    days.push({ date: '2026-11-12', activeSeconds: 1000, questionsAnswered: 10 });
    const resCompleted = evaluateCommitment(commitment, days, '2026-11-12');
    expect(resCompleted.status).toBe('completed');
    expect(resCompleted.minutesDone).toBe(61);
    expect(resCompleted.text).toBe('Commitment complete. You can set a new one whenever you like.');
  });

  it('evaluates days streak with rest day used', () => {
    const commitment: CommitmentRow = {
      type: 'days',
      target: 5,
      startDate: '2026-11-01',
      restDaysAllowed: 1,
      restDayUsed: false,
    };
    // Day 1 done, Day 2 missed (rest day used), Day 3 done, Day 4 (today, not done yet)
    const days: PracticeDay[] = [
      { date: '2026-11-01', activeSeconds: 700, questionsAnswered: 12 },
      { date: '2026-11-03', activeSeconds: 650, questionsAnswered: 10 },
    ];

    const res = evaluateCommitment(commitment, days, '2026-11-04');
    expect(res.status).toBe('active');
    expect(res.daysDone).toBe(2);
    expect(res.restDayUsed).toBe(true);
    expect(res.text).toBe('Day 2 of 5 done. Your rest day has been used.');
  });

  it('marks commitment as broken with neutral wording when second miss occurs', () => {
    const commitment: CommitmentRow = {
      type: 'days',
      target: 5,
      startDate: '2026-11-01',
      restDaysAllowed: 1,
      restDayUsed: false,
    };
    // Day 1 done, Day 2 missed (rest used), Day 3 missed (broken)
    const days: PracticeDay[] = [{ date: '2026-11-01', activeSeconds: 700, questionsAnswered: 12 }];

    const res = evaluateCommitment(commitment, days, '2026-11-04');
    expect(res.status).toBe('broken');
    expect(res.text).toBe('This commitment has ended. You can start a new one whenever you like.');
  });

  it('marks commitment as completed when target days reached', () => {
    const commitment: CommitmentRow = {
      type: 'days',
      target: 3,
      startDate: '2026-11-01',
      restDaysAllowed: 1,
      restDayUsed: false,
    };
    const days: PracticeDay[] = [
      { date: '2026-11-01', activeSeconds: 700, questionsAnswered: 12 },
      { date: '2026-11-02', activeSeconds: 650, questionsAnswered: 10 },
      { date: '2026-11-03', activeSeconds: 800, questionsAnswered: 15 },
    ];

    const res = evaluateCommitment(commitment, days, '2026-11-03');
    expect(res.status).toBe('completed');
    expect(res.daysDone).toBe(3);
    expect(res.text).toBe('Commitment complete. You can set a new one whenever you like.');
  });
});
