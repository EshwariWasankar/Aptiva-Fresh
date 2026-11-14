import { en } from './en.js';
import { hi } from './hi.js';
import { mr } from './mr.js';
import type { Locale, TranslationDictionary } from './types.js';

export * from './types.js';
export { en, hi, mr };

export const dictionaries: Record<Locale, TranslationDictionary> = {
  en,
  hi,
  mr,
};

export type TranslationKey =
  | 'sections.quantitative'
  | 'sections.logical'
  | 'sections.verbal'
  | 'sections.dataInterpretation'
  | 'difficulties.easy'
  | 'difficulties.medium'
  | 'difficulties.hard'
  | 'status.ready'
  | 'status.gap'
  | 'status.inProgress'
  | 'status.completed'
  | 'status.active'
  | 'status.broken'
  | 'commitments.streakActive'
  | 'commitments.restDayUsed'
  | 'commitments.streakComplete'
  | 'commitments.streakEnded'
  | 'commitments.minutesActive'
  | 'actions.start'
  | 'actions.submit'
  | 'actions.continue'
  | 'actions.finish'
  | 'actions.review'
  | 'actions.diagnostics'
  | 'actions.reassessment'
  | 'feedback.correct'
  | 'feedback.incorrect'
  | 'feedback.expectedTime'
  | 'feedback.yourTime'
  | 'feedback.accuracy'
  | 'feedback.score'
  | 'tiers.free'
  | 'tiers.sprintPass'
  | 'tiers.seasonPass';

/**
 * Returns localized string with parameter interpolation.
 * Falls back to English if key or locale is missing.
 */
export function t(
  locale: Locale,
  key: TranslationKey,
  params: Record<string, string | number> = {},
): string {
  const dict = dictionaries[locale] ?? dictionaries.en;
  const dictRecord = dict as unknown as Record<string, Record<string, string>>;
  const enRecord = en as unknown as Record<string, Record<string, string>>;
  const [section, subkey] = key.split('.') as [string, string];
  const val = dictRecord[section]?.[subkey] ?? enRecord[section]?.[subkey];

  if (typeof val !== 'string') {
    return key;
  }

  let result = val;
  for (const [k, v] of Object.entries(params)) {
    result = result.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
  }
  return result;
}
