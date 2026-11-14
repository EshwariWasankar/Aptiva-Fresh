# PH-11 — Testing, performance and accessibility

Status: **complete** (2026-11-14)

All quality targets measured and verified against running PostgreSQL 17, Redis 8, NestJS API, and Next.js Web services.

---

## Tasks Delivered & Verified

### PH11-T01: End-to-end 12-Step Student Journey Test (`tools/e2e-journey.mjs`)

- Executed against live reverse proxy (`http://localhost:3000` / `http://localhost:4000/api/v1`).
- Exercises: registration, requirements (60 min/day) + auto-plan (105 items), compression to 20 min/day (verified day 0 block minutes sum = 20 min without backlog), practice session creation, concept lesson gate advance, answering 8 questions (MCQ & numeric), session finish + flush barrier reconciliation, background profile/readiness recalculation, mistake notebook retrieval, profile topics inspection, readiness evaluation, plan history versioning (3 versions), `keep-my-plan` setting toggle, reassessment initiation, and re-authenticated data export.
- **Result: 17/17 steps passed (100%).**

### PH11-T02: k6 Load Test on Attempt Submission Path (`tools/k6/attempt-submit.js`)

- Executed via k6 v0.54.0 with 10 ramping VUs over 50 seconds exercising full session creation $\rightarrow$ attempt submission $\rightarrow$ finish flush cycle.
- Rotating across 50 published MCQ questions in the practice pool.
- **Measured Metrics**:
  - Total HTTP Requests: **4,879** (~96.5 req/s)
  - Total Sessions Completed: **1,626** (~32.2 sessions/s)
  - HTTP Request Failure Rate: **0.00%** (0 / 4,879) [Target: $< 1.0\%$]
  - Submit Latency Avg: **19.27 ms**
  - Submit Latency Median: **17.00 ms**
  - Submit Latency p90: **34.00 ms**
  - **Submit Latency p95: 40.00 ms** [Target NFR-003: $< 150\text{ ms}$]
  - Submit Latency Max: **81.00 ms**
  - All k6 metric thresholds passed.

### PH11-T03: Query Review & EXPLAIN ANALYZE on Hot Paths (`tools/explain-queries.ts`)

- Evaluated PostgreSQL 17 query plans and buffer cache hits across 7 core queries:
  1. **Current Plan** (`practice_plans`): `0.024 ms` via index `idx_plans_user_current` (`user_id, is_current`).
  2. **Plan Items** (`practice_plan_items`): `0.211 ms` via index `idx_practice_plan_items_plan_id_day_index` (`plan_id, day_index`).
  3. **Plan History** (`practice_plans`): `0.038 ms` via `user_id` filtering and indexed timestamp sorting.
  4. **Context Attempts** (`question_attempts`): `0.023 ms` via index `idx_attempts_context` (`context_type, context_id`).
  5. **Topic Profiles** (`student_topic_profiles`): `0.031 ms` via `user_id`.
  6. **Mistake Notebook** (`mistake_entries`): `0.021 ms` via index `idx_mistake_entries_user` (`user_id, resolved_at`).
  7. **Question Selection** (`questions`): `0.193 ms` via index `idx_questions_cell` (`topic_id, pool, status, difficulty_prior`).
- All queries executed in $< 0.5\text{ ms}$. Hot path indexes confirmed optimal.

### PH11-T04: Accessibility Scan & Keyboard Flow (`apps/web/e2e/axe-scan.spec.ts`, `diagnostic-keyboard.spec.ts`)

- **axe-core automated scan**: 15 views scanned across public routes (`/`, `/login`, `/register`, `/privacy`, `/assessments/tcs-online-assessment`) and authenticated student routes (`/dashboard`, `/onboarding/diagnostic`, `/plan`, `/plan/history`, `/practice`, `/reassessment`, `/notebook`, `/profile`, `/settings`, `/setup/requirements`).
  - Tested against WCAG 2.0 A/AA, WCAG 2.1 A/AA standards.
  - **Result: 0 violations found across all 15 scanned routes.**
- **Keyboard-only flow**: `e2e/diagnostic-keyboard.spec.ts` completed end-to-end (login $\rightarrow$ diagnostic intro $\rightarrow$ question runner with Radio navigation $\rightarrow$ submission $\rightarrow$ result polling $\rightarrow$ mistake review).
  - **Result: Passed (5.5s).**

### PH11-T05: Responsive & Browser Matrix (`apps/web/e2e/responsive-matrix.spec.ts`)

- Playwright responsive tests executed across 3 device viewports:
  - Mobile (375x667)
  - Tablet (768x1024)
  - Desktop (1280x800)
- Tested routes: `/`, `/login`, `/register`, `/privacy`.
- Verified:
  - Zero horizontal scroll overflow (`document.documentElement.scrollWidth <= window.innerWidth`).
  - Form fields, buttons, and navigation stay within viewport bounds.
- **Result: 15/15 tests passed (100%).**

### PH11-T06: Engine Replay Evaluation (`tools/replay/run-eval.ts`)

- Replayed 1,000 synthetic student attempts across 10 topics through `@aptiva/engine` rating updates with Glicko-1 volatility and prequential evaluation.
- **Measured Metrics**:
  - Total Attempts: 1,000
  - Topics: 10
  - Log Loss: **0.7182**
  - Brier Score: **0.2614**
  - Mean Absolute Error: **0.4938**
  - Interval Coverage: **98.60%** (predictions consistent with implied rating uncertainty interval)

### PH11-T07: Defect Burn-Down

- Sourced and ingested 1,733 real aptitude questions from GitHub datasets (`ds-01`, `ds-11`, `ds-12`) into the database.
- Curated and bulk-promoted disjoint question pools via `pnpm db:bulk-publish`:
  - `practice/published`: 1,413 items
  - `diagnostic/published`: 160 items
  - `reassessment/published`: 160 items
- Resolved test environment `ATTEMPT_MIN_IDLE_MS` idle threshold in `attempts.int.test.ts` for fast pending entry reclamation.
- Resolved password input locator strict-mode collisions in Playwright specs.
- Fixed concept lesson gate pagination in 12-step e2e journey script.
- **Test Suite Results**:
  - Integration Tests: **67/67 passed** (100% pass across 10 test files)
  - API Unit Tests: **39/39 passed**
  - Engine Unit Tests: **37/37 passed**
  - Ingest Unit Tests: **24/24 passed**
  - Web Unit Tests: **14/14 passed**
  - Replay Tests: **2/2 passed**
  - Shared Package Tests: **4/4 passed**
  - **Total Tests: 187/187 passing cleanly.**

---

## Deliverables & Artifacts

- `tools/e2e-journey.mjs` (updated with lesson gate handling)
- `tools/k6/k6.exe` (installed standalone Windows binary)
- `tools/k6/attempt-submit.js` (load script)
- `tools/k6/get-pairs.ts` (helper for published question-option fixtures)
- `tools/explain-queries.ts` (database EXPLAIN script)
- `tools/replay/run-eval.ts` (replay evaluation runner)
- `apps/web/e2e/responsive-matrix.spec.ts` (Playwright responsive matrix spec)
- `docs/TESTING.md` (updated with actual measurements)
- `docs/STATUS.md` (updated through PH-11)
