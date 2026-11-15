import { describe, expect, it } from 'vitest';
import { en, hi, mr, t } from '../src/i18n/index.js';

describe('i18n vocabulary and translations (PH13-T08)', () => {
  function verifyKeyParity(base: object, target: object, path = '') {
    const baseRec = base as Record<string, unknown>;
    const targetRec = target as Record<string, unknown>;
    for (const key of Object.keys(baseRec)) {
      const currentPath = path ? `${path}.${key}` : key;
      expect(targetRec).toHaveProperty(key);
      const baseVal = baseRec[key];
      const targetVal = targetRec[key];
      if (typeof baseVal === 'object' && baseVal !== null) {
        verifyKeyParity(baseVal, targetVal as object, currentPath);
      } else {
        expect(typeof targetVal).toBe('string');
        expect((targetVal as string).length).toBeGreaterThan(0);
      }
    }
  }

  it('ensures Hindi dictionary has 100% key parity with English', () => {
    verifyKeyParity(en, hi);
  });

  it('ensures Marathi dictionary has 100% key parity with English', () => {
    verifyKeyParity(en, mr);
  });

  it('interpolates parameters correctly in English, Hindi, and Marathi', () => {
    const enStr = t('en', 'commitments.streakActive', { daysDone: 3, target: 7 });
    expect(enStr).toBe('Day 3 of 7 done.');

    const hiStr = t('hi', 'commitments.streakActive', { daysDone: 3, target: 7 });
    expect(hiStr).toBe('7 में से 3 दिन पूरे।');

    const mrStr = t('mr', 'commitments.streakActive', { daysDone: 3, target: 7 });
    expect(mrStr).toBe('7 पैकी 3 दिवस पूर्ण झाले.');
  });

  it('falls back to English when key exists in English', () => {
    const res = t('en', 'sections.quantitative');
    expect(res).toBe('Quantitative Aptitude');

    const hiRes = t('hi', 'sections.quantitative');
    expect(hiRes).toBe('संख्यात्मक अभियोग्यता');
  });
});
