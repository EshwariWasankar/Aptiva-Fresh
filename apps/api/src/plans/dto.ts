import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');
const dayMinutes = z.number().int().min(0).max(240);

export const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

export const MinutesPerWeekday = z
  .object({
    mon: dayMinutes.optional(),
    tue: dayMinutes.optional(),
    wed: dayMinutes.optional(),
    thu: dayMinutes.optional(),
    fri: dayMinutes.optional(),
    sat: dayMinutes.optional(),
    sun: dayMinutes.optional(),
  })
  .strict();
export type MinutesPerWeekday = z.infer<typeof MinutesPerWeekday>;

export const TargetSplitItem = z
  .object({
    company: z.string().min(1),
    targetDate: isoDate,
    weight: z.number().positive().default(1.0),
  })
  .strict();
export type TargetSplitItem = z.infer<typeof TargetSplitItem>;

export const RequirementsBody = z
  .object({
    assessmentId: z.string().uuid().nullable().optional(),
    mode: z.enum(['general', 'assessment_specific']).default('general'),
    testDate: isoDate,
    deadlineDate: isoDate,
    minutesPerWeekday: MinutesPerWeekday,
    blockLengthMinutes: z.union([
      z.literal(15),
      z.literal(30),
      z.literal(45),
      z.literal(60),
      z.literal(90),
    ]),
    wantedTopics: z.array(z.string().min(1)).max(20).default([]),
    preparationLevel: z
      .enum(['starting', 'revising', 'cramming', 'maintaining'])
      .nullable()
      .optional(),
    knownInfo: z.record(z.string(), z.unknown()).nullable().optional(),
    targets: z.array(TargetSplitItem).max(5).optional(),
  })
  .strict();
export type RequirementsBody = z.infer<typeof RequirementsBody>;

export const GeneratePlanBody = z
  .object({
    /** Optional per-weekday override merged over the stored requirement. */
    minutesPerWeekday: MinutesPerWeekday.optional(),
  })
  .strict();
export type GeneratePlanBody = z.infer<typeof GeneratePlanBody>;

/** E-034-adjacent feedback on a plan block (PH9-T07). */
export const ItemFeedbackBody = z.object({
  reason: z.enum(['already_know', 'too_easy', 'not_relevant']),
  note: z.string().max(500).optional(),
});
export type ItemFeedbackDto = z.infer<typeof ItemFeedbackBody>;

/** E-035 — keep-my-plan, pins, reminder limits. */
export const PlanSettingsBody = z.object({
  keepMyPlan: z.boolean().optional(),
  pins: z.array(z.string().uuid()).max(500).optional(),
  reminderLimits: z.record(z.string(), z.unknown()).optional(),
});
export type PlanSettingsDto = z.infer<typeof PlanSettingsBody>;
