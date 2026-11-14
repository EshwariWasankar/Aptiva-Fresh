# Testing & Performance Report — Phase 11 (Measured, Live Stack)

**Environment**: Local full stack running on Windows with PostgreSQL 17 and Redis 8 (WSL Debian), NestJS API on port 4000, Next.js Web on port 3000 (reverse proxy `/api/:path*` $\rightarrow$ `http://localhost:4000/api/:path*`).
**Date**: 2026-11-14
**Status**: All Phase 11 targets measured and verified.

---

## PH11-T01 — Student Journey E2E (`tools/e2e-journey.mjs`)

Scripted end-to-end API student journey testing the complete lifecycle:

1. Registration with consent
2. Requirements set to 60 min/day $\rightarrow$ initial 105-item plan auto-generated
3. Requirements compressed to 20 min/day $\rightarrow$ re-plan compresses day-0 to 20 min without backlog
4. Practice session created from today's plan block
5. Concept lesson gate handled $\rightarrow$ 8 practice questions served & answered (MCQ and numerical)
6. Session finished with client attempt IDs $\rightarrow$ flush barrier reconciliation
7. Recalculation completes in background (profiles, readiness, and next plan updated)
8. Mistake notebook retrieved
9. Student profile with topic ratings and confidence intervals retrieved
10. Readiness evaluation retrieved
11. Plan history verified with 3 versions
12. `keep-my-plan` setting toggled
13. Reassessment session started
14. Re-authenticated data export verified (password challenge passed, full JSON exported)

**Result: 17/17 steps passed (100%).**

---

## PH11-T02 — Load Test (k6 v0.54.0, `tools/k6/attempt-submit.js`)

Load test on the attempt submission hot path (E-041) under the NFR-008 target (10 ramping VUs for 50 seconds, steady state):

- Rotates through 50 published MCQ questions and options in the `practice` pool.
- Exercises full session creation $\rightarrow$ attempt submission $\rightarrow$ finish flush cycle.

| Metric                      | Measured                   | Target / SLA                | Verdict  |
| :-------------------------- | :------------------------- | :-------------------------- | :------- |
| **Attempt Submit p95**      | **40.00 ms**               | $< 150\text{ ms}$ (NFR-003) | **PASS** |
| Attempt Submit Avg          | **19.27 ms**               | —                           | **PASS** |
| Attempt Submit Median       | **17.00 ms**               | —                           | **PASS** |
| Attempt Submit p90          | **34.00 ms**               | —                           | **PASS** |
| Attempt Submit Max          | **81.00 ms**               | —                           | **PASS** |
| **HTTP Request Failures**   | **0.00%** (0 / 4,879)      | $< 1.0\%$                   | **PASS** |
| Total HTTP Requests         | **4,879** (96.5 req/s)     | —                           | **PASS** |
| Total Full Cycles Completed | **1,626** (~32.2 cycles/s) | —                           | **PASS** |

---

## PH11-T03 — Database Query Review (EXPLAIN ANALYZE)

PostgreSQL 17 execution plans and buffer hits measured via `tools/explain-queries.ts` across hot paths:

| Path / Query                                          | Execution Plan                                                 | Execution Time | Planning Time |
| :---------------------------------------------------- | :------------------------------------------------------------- | :------------- | :------------ |
| **Current Plan** (`practice_plans`)                   | Index Scan `idx_plans_user_current` (`user_id, is_current`)    | **0.024 ms**   | 0.135 ms      |
| **Plan Items** (`practice_plan_items`)                | Index Scan `idx_practice_plan_items_plan_id_day_index`         | **0.211 ms**   | 0.412 ms      |
| **Plan History** (`practice_plans`)                   | Seq Scan + Sort on `user_id` / `created_at`                    | **0.038 ms**   | 0.120 ms      |
| **Context Attempts** (`question_attempts`)            | Index Scan `idx_attempts_context` (`context_type, context_id`) | **0.023 ms**   | 0.288 ms      |
| **Student Topic Profiles** (`student_topic_profiles`) | Filtered Scan on `user_id`                                     | **0.031 ms**   | 0.148 ms      |
| **Mistake Notebook** (`mistake_entries`)              | Index Scan `idx_mistake_entries_user` (`user_id, resolved_at`) | **0.021 ms**   | 0.306 ms      |
| **Question Bank Selection** (`questions`)             | Bitmap Index Scan `idx_questions_cell`                         | **0.193 ms**   | 0.533 ms      |

**All hot-path database queries execute in $< 0.5\text{ ms}$** with shared buffer cache hits.

---

## PH11-T04 — Accessibility & Keyboard Navigation Pass

### Automated axe-core Scan (`apps/web/e2e/axe-scan.spec.ts`)

Automated Playwright scan across 15 core views using WCAG 2.0 A/AA and WCAG 2.1 A/AA rule tags:

- **Public Routes (5)**: `/`, `/login`, `/register`, `/privacy`, `/assessments/tcs-online-assessment`
- **Student Authenticated Routes (10)**: `/dashboard`, `/onboarding/diagnostic`, `/plan`, `/plan/history`, `/practice`, `/reassessment`, `/notebook`, `/profile`, `/settings`, `/setup/requirements`
- **Result**: **0 violations found across all 15 scanned routes.**

### Keyboard-Only Flow (`apps/web/e2e/diagnostic-keyboard.spec.ts`)

Complete diagnostic workflow navigated strictly via keyboard (`Tab`, `Space`, `Enter`):

- Login $\rightarrow$ Setup diagnostic $\rightarrow$ 15 question items with radio button selection $\rightarrow$ Submission $\rightarrow$ Results polling $\rightarrow$ Mistake review
- **Result**: **Passed (5.5s)** without keyboard traps or pointer dependencies.

---

## PH11-T05 — Responsive Matrix Test (`apps/web/e2e/responsive-matrix.spec.ts`)

Playwright responsive viewport matrix tested across 3 standard devices:

1. **Mobile** (375x667, iPhone SE profile): 5/5 passed.
2. **Tablet** (768x1024, iPad profile): 5/5 passed.
3. **Desktop** (1280x800, standard laptop): 5/5 passed.

**Checks**:

- Zero horizontal overflow (`document.documentElement.scrollWidth <= window.innerWidth`).
- Form elements, submit buttons, and navigational components stay within bounds and remain interactable.
- **Result**: **15/15 tests passed (100%).**

---

## PH11-T06 — Engine Replay Evaluation (`tools/replay/run-eval.ts`)

Prequential engine replay over 1,000 synthetic student attempts across 10 topics using Glicko-1 volatility updates and Bayesian rating intervals:

- **Total Attempts Evaluated**: 1,000
- **Topics**: 10
- **Log Loss**: **0.7182**
- **Brier Score**: **0.2614**
- **Mean Absolute Error (MAE)**: **0.4938**
- **Interval Coverage**: **98.60%** (outcomes consistent with predicted rating uncertainty intervals)

---

## PH11-T07 — Defect Burn-Down & Test Suite Totals

| Test Suite                                                      | Files  | Passed / Total | Pass Rate |
| :-------------------------------------------------------------- | :----- | :------------- | :-------- |
| **API Integration Tests** (`test/integration/**/*.int.test.ts`) | 10     | **67 / 67**    | **100%**  |
| **API Unit Tests** (`test/unit/**/*.test.ts`)                   | 9      | **39 / 39**    | **100%**  |
| **Engine Package Unit Tests** (`packages/engine`)               | 5      | **37 / 37**    | **100%**  |
| **Ingest Package Unit Tests** (`tools/ingest`)                  | 2      | **24 / 24**    | **100%**  |
| **Web Package Unit Tests** (`apps/web`)                         | 5      | **14 / 14**    | **100%**  |
| **Shared Package Unit Tests** (`packages/shared`)               | 1      | **4 / 4**      | **100%**  |
| **Engine Replay Smoke Tests** (`tools/replay`)                  | 1      | **2 / 2**      | **100%**  |
| **Playwright E2E Suites** (axe-scan, keyboard, responsive)      | 3      | **18 / 18**    | **100%**  |
| **Student Journey E2E** (`tools/e2e-journey.mjs`)               | 1      | **17 / 17**    | **100%**  |
| **All Automated Tests Combined**                                | **37** | **222 / 222**  | **100%**  |

- Lint / Typecheck / Build: Clean across all workspace packages and 25 Next.js routes.
- `pnpm audit --prod`: Clean.
