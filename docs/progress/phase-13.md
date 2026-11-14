# PH-13 — Post-launch and backlog

Status: **complete** (2026-11-14)

Post-launch enhancements, monetization tiers, multi-target preparation, commitment streaks with neutral wording, external score logging, structural pattern reports with question leak prevention, opt-in reminders/summaries, and multi-language i18n support delivered and verified.

---

## Delivered Tasks & Evidence

### PH13-T01: Pilot Evaluation Runner & Cohort Analysis Module

- Implementation: `tools/pilot-eval.ts` (invocable via `pnpm pilot:eval`).
- Features:
  - Cohort comparison: Pilot intervention group vs. Control group.
  - Learning gain metrics: Absolute gain ($\Delta \mu$), Hake's normalized relative gain ($g$).
  - Effect size: Cohen's $d$ with 95% Confidence Intervals.
  - Pace improvement (seconds per question) and section-by-section gain breakdowns (Quant, Logical, Verbal, DI).
  - Generates structured artifacts: `docs/reports/pilot-evaluation-report.json` and `docs/reports/pilot-evaluation-report.md`.
- Verification: Mean pilot gain +19.91% ($d = 1.458$, large effect size) vs control +5.06% ($d = 0.372$, $p < 0.001$).

### PH13-T02: Billing and Tiers (Free, Sprint Pass, Season Pass, Idempotent Webhook)

- Prisma Models: `UserPass` (`user_passes`), `BillingEvent` (`billing_events`).
- Tiers supported:
  - `free`: Diagnostic and Readiness Gap assessment, 1 practice plan.
  - `sprint_7d`: 7-day Sprint Pass (₹499).
  - `sprint_14d`: 14-day Sprint Pass (₹799).
  - `season_1m`: 1-month Season Pass (₹1,299).
  - `season_3m`: 3-month Season Pass (₹2,499).
- Endpoints (E-093):
  - `POST /api/v1/billing/orders`: Generates order details for pass checkout.
  - `POST /api/v1/billing/webhook`: Idempotent gateway webhook. Verifies idempotency key against `billing_events`; prevents duplicate pass creations while granting instant access.
  - `GET /api/v1/me/subscription`: Returns active pass, validity, days remaining, and feature gates.
- Verification: `apps/api/test/integration/billing.int.test.ts` (3/3 pass).

### PH13-T03: Multiple Targets with Date and Priority Split

- Engine Logic: `blendBlueprints(targets: TargetInput[])` in `packages/engine/src/priority.ts`.
- Features:
  - Normalizes target weights ($w_k$) and calculates blended topic shares across multiple companies.
  - Blends urgency horizon and difficulty/pace expectations based on dates and weights.
  - Produces a single coherent plan balancing both target companies according to FR-022.
- Prisma Model: `PreparationTarget` (`preparation_targets`) linked to `PreparationRequirement`.
- API: `putRequirements` and `getRequirements` persist and return multi-target splits.
- Verification: `packages/engine/test/multi-target.test.ts` (2/2 pass).

### PH13-T04: Commitment Streak with Rest Day and Neutral Wording

- Engine Logic: `evaluateCommitment(c, days, today, cfg)` in `packages/engine/src/commitments.ts` per Section 17.7.
- Features:
  - Days-in-row and minutes targets.
  - 1 rest day automatically covers a single missed day before today.
  - Today is never treated as a miss.
  - Zero-guilt neutral copy:
    - Active: `"Day X of Y done."` / `"Your rest day has been used."`
    - Completed: `"Commitment complete. You can set a new one whenever you like."`
    - Ended: `"This commitment has ended. You can start a new one whenever you like."`
- Prisma Models: `UserCommitment` (`user_commitments`), `PracticeDay` (`practice_days`).
- Endpoints (E-090, E49–E51): `GET /api/v1/me/commitment`, `PUT /api/v1/me/commitment`, `DELETE /api/v1/me/commitment`, `POST /api/v1/me/commitment/activity`. Automatically recorded on session completion.
- Verification: `packages/engine/test/commitments.test.ts` (4/4 pass), `apps/api/test/integration/commitments.int.test.ts` (5/5 pass).

### PH13-T05: External Score Log (Manual Entry and CSV Upload)

- Prisma Model: `ExternalScore` (`external_scores`).
- Endpoints (E-091, FR-024):
  - `GET /api/v1/me/external-scores`: Lists student's outside scores.
  - `POST /api/v1/me/external-scores`: Validates score bounds (totalScore <= maxScore) and stores entry.
  - `POST /api/v1/me/external-scores/csv`: Parses batch CSV uploads with error handling.
  - `DELETE /api/v1/me/external-scores/:id`: Enforces strict student ownership isolation.
- Verification: `apps/api/test/integration/external-scores.int.test.ts` (4/4 pass).

### PH13-T06: Company Pattern Reports and Drift Alerts

- Prisma Models: `PatternReport` (`pattern_reports`), `PatternDriftAlert` (`pattern_drift_alerts`).
- Endpoints (E-092, FR-025):
  - `POST /api/v1/pattern-reports`: Structure only. Free-text question content or multiple choice stems are strictly rejected with 422.
  - `GET /api/v1/pattern-reports`, `PATCH /api/v1/pattern-reports/:id/review`: Admin moderation queue.
  - `GET /api/v1/admin/drift-alerts`, `POST /api/v1/admin/drift-alerts`, `PATCH /api/v1/admin/drift-alerts/:id/resolve`: Tracks section weight shifts across hiring drives.
- Verification: `apps/api/test/integration/patterns.int.test.ts` (4/4 pass).

### PH13-T07: Reminders and Weekly Summaries Scheduler

- Prisma Model: `NotificationPreference` (`notification_preferences`).
- Features:
  - Opt-in required per FR-028 (student controls optInReminders, optInWeeklySummary, and dailyLimit).
  - Neutral weekly summary highlights questions practiced and active time without guilt messaging.
- Endpoints:
  - `GET /api/v1/me/notifications/preferences`
  - `PUT /api/v1/me/notifications/preferences`
  - `GET /api/v1/me/notifications/weekly-summary`
- Verification: `apps/api/test/integration/notifications.int.test.ts` (3/3 pass).

### PH13-T08: Hindi and Regional Language Interface (i18n)

- Implementation: `packages/shared/src/i18n/` (`types.ts`, `en.ts`, `hi.ts`, `mr.ts`, `index.ts`).
- Features:
  - Full translations for test sections (संख्यात्मक अभियोग्यता, तार्किक क्षमता, मौखिक क्षमता, डेटा व्याख्या).
  - Difficulty bands, status badges, commitment messages, action controls, and feedback strings.
  - Parameterized interpolation via `t(locale, key, params)`.
  - 100% key parity enforced between English, Hindi, and Marathi.
- Verification: `packages/shared/test/i18n.test.ts` (4/4 pass).

---

## Verification Summary

| Suite                          | Scope                                                 | Result                                   |
| :----------------------------- | :---------------------------------------------------- | :--------------------------------------- |
| **Engine Unit Tests**          | `packages/engine/test/`                               | **43/43 passed**                         |
| **Shared i18n Tests**          | `packages/shared/test/`                               | **8/8 passed**                           |
| **Monorepo Unit Tests**        | All 6 workspace packages (`pnpm test`)                | **130+ passed**                          |
| **Phase 13 Integration Tests** | Commitments, billing, scores, patterns, notifications | **19/19 passed**                         |
| **Full API Integration Suite** | `pnpm test:integration` (15 test files)               | **86/86 passed**                         |
| **Typecheck**                  | `pnpm typecheck`                                      | **0 errors** across all packages         |
| **Pilot Evaluation**           | `pnpm pilot:eval`                                     | **Pass** ($d = 1.458$, report generated) |
| **Production Smoke**           | `node tools/prod-smoke.mjs`                           | **15/15 passed**                         |
