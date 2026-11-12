import { EMA_ALPHA } from './config.js';

/**
 * Exponential moving averages for accuracy and time (PH6-T02, T-ML-02).
 * First observation initialises the EMA; later values blend with EMA_ALPHA.
 */

export interface EmaState {
  accuracyEma: number | null;
  timeEmaMs: number | null;
}

export interface EmaUpdate {
  state: EmaState;
  /** accuracy / expected-time ratio for this single attempt (pace). */
  paceRatio: number | null;
}

export function updateEma(
  state: EmaState,
  accuracy: number,
  timeMs: number | null,
  expectedTimeMs: number | null,
): EmaUpdate {
  const a = clamp01(accuracy);
  const t = timeMs != null && timeMs >= 0 ? timeMs : null;
  const acc = state.accuracyEma == null ? a : EMA_ALPHA * a + (1 - EMA_ALPHA) * state.accuracyEma;
  const tim =
    state.timeEmaMs == null
      ? t
      : t == null
        ? state.timeEmaMs
        : EMA_ALPHA * t + (1 - EMA_ALPHA) * state.timeEmaMs;
  const paceRatio =
    tim != null && expectedTimeMs != null && expectedTimeMs > 0 && t != null
      ? t / expectedTimeMs
      : null;
  return { state: { accuracyEma: acc, timeEmaMs: tim }, paceRatio };
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}
