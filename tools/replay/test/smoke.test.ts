import { describe, expect, it } from 'vitest';
import { replayAttempts, syntheticAttempts, REPLAY_TOOL_VERSION } from '../src/index.js';

describe('@aptiva/replay', () => {
  it('exposes a version marker', () => {
    expect(REPLAY_TOOL_VERSION).toBe('0.1.0');
  });

  it('reports finite metrics on synthetic data', () => {
    const report = replayAttempts(syntheticAttempts(6, 40));
    expect(report.attempts).toBe(240);
    expect(report.topics).toBe(6);
    expect(report.logLoss).toBeGreaterThan(0);
    expect(report.logLoss).toBeLessThan(2);
    expect(report.brier).toBeGreaterThan(0);
    expect(report.brier).toBeLessThan(0.5);
    expect(report.intervalCoverage).toBeGreaterThan(0);
    expect(report.intervalCoverage).toBeLessThanOrEqual(1);
  });
});
