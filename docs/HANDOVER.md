# Aptiva (PrepPilot) — Complete Handover Document

> Audience: anyone cloning this repo to continue development. Read top to bottom once;
> keep Sections 4–6 open while working — they are the functional spec of what exists today.

---

## 1. What this product is

Aptiva is an **adaptive aptitude-preparation platform** for campus placement tests
(TCS-style online assessments and similar). It is not a question bank with a UI — it is a
**planning layer above question banks**:

```
diagnostic → skill estimates (Glicko-style ratings) → prioritized study plan
          → daily practice blocks → instant server-side marking
          → profile/plan update → reassessment loop
```

Core principles enforced everywhere:

- **Server-authoritative**: answers are marked on the server; answer keys never reach
  the client before submission.
- **Time is measured server-side** (`shown_at`/`answered_at`); client clocks are ignored.
- **Pools are disjoint**: `diagnostic`, `practice`, `reassessment` question pools never
  overlap, so reassessment measures learning, not memory.
- **Honest uncertainty**: every estimate carries an interval; thin evidence is flagged,
  never hidden.

---

## 2. Repository layout

```
aptiva main/
├── apps/
│   ├── api/            NestJS REST API (port 4000, prefix /api/v1)
│   │   ├── src/        modules: auth, users, content, import, attempts,
│   │   │               diagnostic, profile, plans, reassessment, privacy,
│   │   │               admin, health, common (guards/config/audit/redis/prisma)
│   │   ├── generated/  Prisma client (generated — do not edit)
│   │   └── test/       unit + integration suites (real PG+Redis)
│   └── web/            Next.js 16 App Router (port 3000)
│       ├── src/app/    routes: (public), (student), (admin), login/register/…
│       ├── src/components/  shared UI (PasswordInput, Katex, panels…)
│       ├── src/lib/    apiClient (token/refresh), domain clients
│       └── e2e/        Playwright specs (keyboard pass + axe scans)
├── packages/
│   ├── engine/         pure TypeScript math: rating (Glicko-1), EMA, marking,
│   │                   diagnostic analysis, error inference, priorities,
│   │                   candidates, planner (knapsack), readiness
│   └── shared/         shared types/constants
├── tools/
│   ├── ingest/         dataset fetch/parse/import pipeline (DS-01, DS-11, DS-12)
│   ├── k6/             load script for the attempt-submit path
│   └── replay/         offline engine evaluation (log loss / Brier / coverage)
├── prisma/
│   ├── schema.prisma  single source of truth for the DB
│   ├── migrations/    ordered SQL migrations
│   ├── seed*.ts       taxonomy, diagnostic curation, MCQ topics, bulk publish
│   └── bulk-publish.ts ops script (see §8)
├── infra/docker-compose.yml   PostgreSQL + Redis (local dev = "staging-like")
├── docs/              progress/phase-*.md reports, STATUS.md, TESTING.md,
│                      SECURITY.md, PRIVACY.md, ARCHITECTURE.md
└── playbook.md        the original implementation spec (phases PH-0…PH-13)
```

---

## 3. Setup — install and run from scratch

**Prerequisites**: Node 22 (`.nvmrc`), pnpm 12, Docker Desktop.

```powershell
# 1. Install everything (also runs `prisma generate` via postinstall)
pnpm install

# 2. Start PostgreSQL + Redis
docker compose -f infra/docker-compose.yml up -d

# 3. Configure env — copy and fill in values
copy apps\api\.env.example apps\api\.env
# Required in apps/api/.env:
#   DATABASE_URL=postgresql://aptiva:aptiva@localhost:5432/aptiva
#   REDIS_URL=redis://localhost:6379
#   JWT_ACCESS_SECRET=<random 32+ chars>
#   CORS_ORIGINS=http://localhost:3000
#   WEB_BASE_URL=http://localhost:3000
# apps/web/.env already exists; API_INTERNAL_URL=http://localhost:4000

# 4. Apply migrations + seed taxonomy/content
pnpm db:migrate:deploy
pnpm db:seed            # taxonomy + error types + blueprints
pnpm db:seed-mcq-topics # topic synonyms for MCQ sources (idempotent)

# 5. Create the first admin (adjust email/password)
#    Easiest: register via UI then UPDATE users SET role='admin'
#    Or use an existing admin@aptiva.local in dev DBs.

# 6. Run dev servers (two terminals)
pnpm --filter @aptiva/api dev     # API  → http://localhost:4000/api/v1
pnpm --filter @aptiva/web dev     # Web  → http://localhost:3000
```

**Verify**: `curl http://localhost:4000/api/v1/health` → `{"status":"ok"}`;
`/api/v1/ready` → 200 only when DB+Redis are up.

**Dev credentials** (local dev DB only): `admin@aptiva.local` / `Admin-pass-123!`.

---

## 4. Complete feature inventory

Every screen, every button, every endpoint. Routes marked 🔒 require login;
👑 additionally require `admin`/`reviewer` role.

### 4.1 Public / marketing

| Route                 | What it does                                                                                                                                                                                                                                                               |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                   | Landing page. Auth-aware CTAs: logged-out → "Create free account"/"See assessments"; logged-in → "Go to dashboard". Step cards are static marketing.                                                                                                                       |
| `/assessments/[slug]` | Public assessment page (e.g. `/assessments/tcs-online-assessment`): duration, question count, negative marking, format mix, **topic weights with provenance badges** (source file @ commit, `candidate_reported` vs `verified` flags), disclaimer footer. No login needed. |
| `/login`              | Email + password (`PasswordInput` eye toggle). Errors: generic "Invalid email or password" (429 → rate-limit message; network down → "Cannot reach the server"). Link to `/reset-password` and `/register`. Google OAuth button when configured. Success → `/dashboard`.   |
| `/register`           | Email, password (policy: length + HIBP breach check), graduation year, branch, optional college, **mandatory consent checkbox** (privacy notice version `2026-11`). Success → session → `/dashboard`.                                                                      |
| `/reset-password`     | Two-step: request link by email → set new password via `?token=`. Backend sends email via `EMAIL_API_KEY` (unverified in dev).                                                                                                                                             |
| `/verify-email`       | Consumes `?token=` from verification email; shows status.                                                                                                                                                                                                                  |
| `/privacy`            | Static privacy page.                                                                                                                                                                                                                                                       |

### 4.2 Student app shell

Dark slate sticky header on every `(student)` page: **Aptiva** logo →
Dashboard · Diagnostic · Plan · Practice · Reassessment · Notebook · Profile ·
Settings · user email · Sign out (revokes refresh token, redirects to `/login`).
Active route highlighted. All student routes are wrapped in `RequireAuth`
(redirects to `/login` when unauthenticated).

### 4.3 Dashboard — `/dashboard`

Fetches in parallel: current plan, readiness, today's plan items, profile
summary, recent "what changed" entries.

- **Readiness card**: band (low–high %) + confidence badge (low/medium/high).
- **Today's plan**: blocks scheduled for today with per-block **Start** button
  → creates a practice session → `/practice/session/[id]`.
- **Priorities**: top ranked topics ("why" = gap × blueprint share × urgency).
- **Low-priority topics** list.
- **What changed card**: last recalculation deltas (top-3 movers).
- Empty states link to `/setup/requirements` or `/onboarding/diagnostic`.

### 4.4 Onboarding diagnostic — `/onboarding/diagnostic`

- If a diagnostic is `active`/`paused` → "Resume" button.
- If completed → "already completed" notice (one diagnostic per user, ever).
- Otherwise two cards:
  - **Core diagnostic** — 27 items, ~30 min, full analysis.
  - **Express diagnostic** — 12 items, ~10–15 min, flagged **coarse** in results.
- Start → `POST /me/diagnostics` → `/diagnostic/[id]` runner.

### 4.5 Diagnostic runner — `/diagnostic/[id]`

- Stem (KaTeX renders `$...$`/`$$...$$`), MCQ options **or** numeric input.
- Live timer + expected-time hint + progress bar + "Question n of m".
- **Answer & next** (enabled when answered) / **Skip & next** (when blank) —
  one button, always advances. (An earlier confusing standalone "Skip" was removed.)
- **Pause** — once only; second attempt → error. Paused state → resume screen.
- Server stamps `shown_at` on serve, computes `time_ms` on submit.
- On last item → **Submit diagnostic** → result job (BullMQ) → `/result`.

### 4.6 Diagnostic result — `/diagnostic/[id]/result`

Polls `GET /me/diagnostics/:id/result` until computed, then shows:

- Overall accuracy, per-topic table (rating estimate range, accuracy EMA,
  error mix, item counts, "Early estimate" badges for thin evidence),
  difficulty band, pace ratios, skip positions, consistency metric,
  thin-evidence callout, **"Coarse estimate (express)"** badge when applicable.
- **Review mistakes** → `/diagnostic/[id]/review`.
- **Done** button → `/dashboard`. On submit, the **profile job** runs after the
  flush barrier and writes the baseline `profile_snapshots` row + topic profiles.

### 4.7 Mistake review — `/diagnostic/[id]/review`

- Lists only **wrong/skipped** items: stem, your answer vs correct answer,
  worked solution, time-vs-expected.
- **Error-cause chips** (concept gap / careless / time pressure / misread /
  unknown) + optional note → `PUT /attempts/:attemptId/error-feedback`.
- **ConflictNote**: if your reported cause disagrees with the observed pattern
  (e.g. very fast wrong answer tagged "conceptual gap"), an amber warning shows —
  your label still wins; `inferred` vs `reported` are stored separately.
- **← Back to result** and **Save & done** → `/dashboard`.

### 4.8 Requirements — `/setup/requirements`

Form (`RequirementsForm`): mode general/assessment-specific, assessment picker,
test date + deadline (validated: deadline ≤ test date, test date not past),
**minutes per weekday** (mon–sun, multiples of 5), block length (15/30/45/60/90),
wanted topics, preparation level, known-info notes.

- `PUT /me/requirements` validates (T-012 rules) and **auto-generates the first
  plan** in the same request.
- Save → redirect to `/plan`.

### 4.9 Plan — `/plan`

- Header: readiness band, plan metadata (items count, engine version),
  **Edit requirements** → `/setup/requirements`, **Regenerate** → `POST /me/plans`.
- **What changed** collapsible: last 5 `plan_change_log` entries (trigger + item count).
- Per day card: date, total minutes, ordered blocks. Each block shows:
  - block-type chip (concept repair / targeted practice / timed set /
    formula revision / mixed check / speed drill / short review / maintenance / probe)
  - topic name, 📌 pin indicator, minutes
  - **Start** (today's blocks only) → `POST /sessions` → runner
  - **Why this?** expandable → `GET …/rationale` panel: accuracy, conceptual
    share, blueprint share + source, days left, priority, expected gain,
    "would change if…"
  - **Block feedback row** (PH9-T07): _Already know this / Too easy /
    Not relevant_ → `POST …/feedback`; `too_easy`/`not_relevant` suppress that
    topic from new candidates for 14 days. ✓ shows when recorded.
- **History** link → `/plan/history`.

### 4.10 Plan history — `/plan/history` (P-16)

- Table of all plan versions: current badge, created-at, trigger
  (setup/session/reassessment/requirements_change/restore), planner method
  (knapsack/fallback), engine version, item count.
- **Compare** → side-by-side per-topic minutes vs current plan.
- **Restore** → `POST /me/plans/:planId/restore` — copies that version's
  **future days** into a NEW current plan (today/past items carried over,
  change-log trigger `restore`). Old versions are never mutated.

### 4.11 Practice launcher — `/practice`

- Today's scheduled blocks as cards (block type, topic, minutes) each with
  **Start** → session runner.
- "Nothing scheduled for today" empty state → link to plan.
- **Mistake notebook** link → `/notebook`.

### 4.12 Practice runner — `/practice/session/[id]` (P-14)

- Block header (what it targets), live timer, progress.
- MCQ: option select → instant **correct/wrong** feedback on submit.
- Numerical: input box; accepted within per-question tolerance
  (`max(0.001, |answer| × 0.005)`, stored `decimalPlaces` hint shown).
- After answering: **correct answer + worked solution revealed** (server-side
  reveal endpoint — keys never precede submission) + **one-tap error-cause
  chips** (`PUT /attempts/:attemptId/error-feedback`, same inference/conflict
  logic as diagnostic).
- Concept-repair blocks show the published lesson once before questions.
- `concept_repair`/`targeted_practice` selection: unseen-first, difficulty
  steps ≤1 band, topic-share cap; graceful pool-exhaustion.
- **Finish** → `POST /sessions/:id/finish` → **flush barrier**: response is
  202 only after all attempt ids are queryable; then a BullMQ recalc job runs.

### 4.13 Session summary — `/practice/session/[id]/summary` (P-15)

- Polls `GET /sessions/:id/summary` until `recalcStatus` leaves `pending`.
- Shows: accuracy, time-vs-pace, per-topic results, recalculation status.
- For reassessment kinds (`check`/`topic_test`/`mock`) → **View comparison**
  button → `/reassessment/[id]`.
- **View updated plan** → `/plan`; neutral **retry** button if recalc `failed`
  (`POST …/recalc-retry`, 3 attempts, never blocks practice).

### 4.14 What the recalc job does (after every finished session)

1. Recompute all topic profiles from **all** attempts (Glicko-1 rating ± RD,
   accuracy/time EMAs, reported-vs-inferred error mix).
2. Write `profile_snapshots` row (trigger `session`).
3. Write `readiness_estimates`.
4. Regenerate the plan for **future days only** (skipped entirely when
   `keepMyPlan` is on) + top-3 `plan_change_log` "what changed" entries.
5. For reassessment sessions also compute `reassessment_results`.

### 4.15 Reassessment — `/reassessment` (P-18)

- Three kinds: **Short check** (~10q/10m), **Topic test** (~15q/15m, requires
  topic picker fed by profile topics), **Mock** (~30q/30m).
- `POST /me/reassessments` counts **unseen published `reassessment`-pool**
  items: `409 POOL_EXHAUSTED` at zero; `shortened: true` + adjusted minutes
  when the pool is thin (UI shows an amber notice).
- Runs in the same session runner; on finish → summary → comparison.

### 4.16 Reassessment result — `/reassessment/[id]`

`GET /me/reassessments/:id/comparison` (computed lazily, cached in
`reassessment_results`): per-topic **baseline→now rating**, delta, noise label
(`too_early_to_tell` when |Δ| ≤ ½ combined RD — "a change inside the interval"),
`improved`/`declined`/`unchanged`/`no_baseline`, retention (`retained`/`decayed`
from accuracy EMAs), session accuracy. Requires a baseline snapshot — take the
diagnostic first or you get `409 NO_BASELINE`.

### 4.17 Mistake notebook — `/notebook` (P-17)

`GET /me/notebook` — every wrong answer auto-saved with: question, your answer,
correct answer, error cause (reported/inferred + conflict flag), **retry date**
on a 1/3/7/14-day ladder, filters, **Retry** button → starts a targeted session.
Entries auto-resolve when you answer that topic correctly later.

### 4.18 Profile — `/profile`

- Disclaimer: estimates are practice-based, not a prediction of any employer's result.
- **By-section radar** (mean rating per root section) + **Baseline** card
  (snapshot date, engine version).
- **Topics table**: sortable — rating with uncertainty interval, label
  (Weak/Moderate/Strong), attempt count, accuracy EMA, pace ratio, error mix
  (reported vs inferred), thin-evidence "Early estimate" badges.
- **Estimate history**: all `profile_snapshots` (baseline badge, trigger,
  timestamp, engine version).
- Empty state → link to take the diagnostic.

### 4.19 Settings — `/settings` (P-19)

- **Plan**: _Keep my plan_ checkbox → `PUT /me/plan-settings`. When ON, session
  recalcs still update profiles/readiness but do **not** auto-regenerate the plan.
- **Consents**: toggles for `analytics`, `marketing`, `support` →
  `PUT /me/consents` appends `consent_records` (essential processing can't be
  withdrawn). Unknown purposes → 409.
- **Your data**: password field → **Download my data** → `GET /me/data-export`
  with `x-reauth-password` header → full JSON export of everything we store
  (profile, topics, snapshots, requirements, plans+items, sessions, attempts,
  diagnostics, mistakes, consents). Wrong/missing password → 401 `REAUTH_REQUIRED`.
- **Delete account**: password + type `DELETE` → `DELETE /me` (202) →
  `deletion_requested_at` set, **all refresh tokens revoked immediately**;
  hard delete executes via daily BullMQ job after **30 days**; audit keeps only
  the user id. Second request → 409.

### 4.20 Admin console — `/admin` 👑

Nav (admin role only): Overview · Questions · Import · Blueprints · Review.

- **Overview** `/admin`: counts + coverage stats.
- **Questions** `/admin/questions`: paginated/filterable list → editor at
  `/admin/questions/[id]` (`QuestionEditor`): stem (KaTeX preview), MCQ options
  with exactly-one-correct validation, numeric answer/tolerance/decimal places,
  topic, difficulty prior, pool, status, source. **Publish rules enforced
  server-side**: `source_name` required; MCQ needs exactly one correct option;
  numerical needs `numeric_answer`; `diagnostic`/`reassessment` pools need
  **two distinct reviewer approvals**. Violations → 422 `PUBLISH_RULES`.
- **Review queue** `/admin/review`: approve/reject drafts → status `reviewed`;
  same reviewer twice → 409. Approvals are what unlock diagnostic/reassessment
  publishing.
- **Import** `/admin/import` (`ImportPanel`):
  - _Question sources_: pick `ds-01`/`ds-11`/`ds-12` → **Dry run** (report:
    files seen, parsed, accepted, rejected w/ reasons, duplicates) or real
    import (reversible batch, lands as drafts).
  - _Company data_: TCS-pattern records, unmapped-phrase synonym queue.
  - _Coverage_: pool/section/difficulty stats + below-threshold table.
- **Blueprints** `/admin/blueprints` (`BlueprintEditorForm`): versioned
  topic-weight blueprints with provenance (`verified`/`candidate_reported`),
  difficulty bands, pace seconds; one `is_current` per assessment; generic
  fallback blueprint always exists.

Every `/admin/*` call is audit-logged (`admin.access`: actor, method, route —
never bodies) via `AdminAuditInterceptor`.

---

## 5. API surface (all under `/api/v1`)

Envelope: success `{data, meta.requestId}`; error `{error:{code,message,details}}`.
Auth: `Authorization: Bearer <accessToken>` (15 min JWT); refresh via httpOnly
cookie `POST /auth/refresh` (rotation + family revocation on replay).

### Auth & users

`POST /auth/register|login|logout|refresh|verify-email|google` ·
`POST /auth/password-reset/request|confirm` · `GET /me` (profile+consents) ·
`GET/PUT /me/profile` · `GET /me/profile/history`

### Content (public read / admin write)

`GET /assessments`, `GET /assessments/:slug` ·
`GET /questions/:id` (sanitized, no keys) ·
Admin: `GET/POST/PUT /admin/questions`, `POST /admin/questions/:id/review`,
`GET /admin/review-queue`, taxonomy CRUD, `GET/POST/PUT /admin/blueprints`,
import endpoints, `GET /admin/item-stats`, lesson CRUD.

### Attempts & sessions

`POST /sessions` · `GET /sessions/:id/next` (serves question, stamps shown_at) ·
`GET /sessions/:id/questions/:questionId` · `PUT /sessions/:id/attempts/:questionId`
(idempotent by attemptId, server marks + times) · `POST /sessions/:id/finish`
(202 + flush barrier) · `GET /sessions/:id/summary` · `POST /sessions/:id/recalc-retry` ·
`GET /sessions/:id/reveal/:attemptId` · `PUT /attempts/:attemptId/error-feedback`

### Diagnostics

`GET /me/diagnostics/active` · `POST /me/diagnostics` · `GET /me/diagnostics/:id/next`
· `PUT /me/diagnostics/:id/answers/:questionId` · `POST …/pause|submit`
· `GET …/result|review` · `GET /me/diagnostics/error-types`

### Plans & profile

`GET/PUT /me/requirements` · `POST /me/plans` · `GET /me/plans` (history) ·
`GET /me/plans/current` · `GET /me/plans/:planId` · `GET …/items/:itemId/rationale`
· `GET …/changes` · `POST …/restore` · `POST …/items/:itemId/feedback` ·
`GET/PUT /me/plan-settings` · `GET /me/readiness` · `GET /me/profile[/history]`

### Reassessment & notebook

`POST /me/reassessments` · `GET /me/reassessments/:id/comparison` ·
`GET /me/notebook`

### Privacy

`GET /me/data-export` (re-auth header) · `DELETE /me` (re-auth, 202) ·
`PUT /me/consents`

### Ops

`GET /health` (liveness) · `GET /ready` (DB+Redis, 503 when down) ·
`GET /api/docs` Swagger UI.

---

## 6. Data model (Prisma — `prisma/schema.prisma`)

- **users**: citext email, argon2id `password_hash`, role (`student|reviewer|admin`),
  `email_verified_at`, `deletion_requested_at`, `plan_settings` JSONB.
- **refresh_tokens / auth_tokens**: hashed tokens, family id, rotation/revocation.
- **consent_records**: append-only (user, notice_version, purpose, granted).
- **taxonomy**: sections → topics → sub-topics; `topic_synonyms` for import mapping.
- **assessments / assessment_blueprints / blueprint_versions / blueprint_items**:
  versioned weights + provenance + `is_current`.
- **questions**: `format` (mcq|numerical), stem, `pool` (diagnostic|practice|
  reassessment), `status` (draft|reviewed|published|retired), `source_name`,
  `stem_hash` unique, `difficulty_prior`, `elo_rating`, `expected_time_ms`,
  tolerance/decimal fields, `import_batch_id`. Options in `question_options`
  (exactly one `is_correct` for MCQ). Reviews in `question_reviews`
  (unique per question+reviewer).
- **lessons**: concept-repair content shown before targeted blocks.
- **practice_sessions**: kind (practice|check|topic_test|mock), status,
  `recalc_status` (none|pending|done|failed), planned minutes, topic/block.
- **question_attempts**: user, question, context (diagnostic|practice|
  reassessment + context_id), shown/answered timestamps → `time_ms`,
  is_correct, skipped, sequence_no, selected option / numeric input,
  answer_changes, revisit_count.
- **error_feedback / error_inference**: reported vs inferred cause + conflict.
- **student_topic_profiles**: per user+topic — Glicko `rating`,`rd`,
  `accuracy_ema`,`time_ema_ms`, `attempt_count`, `error_mix` JSONB.
- **profile_snapshots**: trigger (baseline|session|reassessment|edit),
  `is_baseline`, full data JSONB, engine_version.
- **preparation_requirements**: one active per user (dates, per-weekday minutes,
  block length, wanted topics, level, known_info).
- **practice_plans / practice_plan_items**: versioned plans (`is_current`,
  trigger, planner_method, engine_version, elapsed_ms); items have day_index,
  order_no, block_type, topic, minutes, pinned, rationale JSONB (incl. feedback[]),
  status (planned|started|completed|skipped|removed).
- **plan_change_log**: per-plan trigger + summary JSONB (what changed).
- **readiness_estimates**: band low/expected/high + confidence + factors.
- **reassessment_results**: session → baseline snapshot + comparison JSONB.
- **mistake_entries**: notebook rows with retry ladder scheduling.
- **diagnostic_tests**: lifecycle + result JSONB.
- **import_batches / import_records / company_data**: ingestion provenance.
- **audit_log**: actor, action, object, details — never secrets/content bodies.

Engine versions are stamped on plans/snapshots so rating changes are auditable.

---

## 7. How the engines work (packages/engine)

- **marking**: MCQ exact option match; numerical `|input − key| ≤ tolerance`
  (+ rounding-suspicion flag). Server-side only.
- **rating (Glicko-1)**: per-topic rating + RD; updated prequentially per attempt;
  question `elo_rating` updated once it has ≥30 responses.
- **profileFromAttempts**: rebuilds topic profiles from the full attempt history
  (deterministic, idempotent — safe to re-run).
- **inferError / analyzeDiagnostic**: rule-based error-cause inference +
  diagnostic result aggregation (accuracy, pace, skips, consistency, thin evidence).
- **priorities**: gap-to-target × blueprint share × urgency × error pressure ×
  evidence factor (+ profile-share floor so off-blueprint weaknesses still plan).
- **candidates**: 9 block types chosen by error mix/accuracy/thin-evidence;
  **cram mode** (`daysLeft ≤ 2`) restricts to drills/revision only.
- **planner**: per-day 0/1 **knapsack** with 250 ms deadline → deterministic
  greedy fallback, exact-minute repair, ≤2 consecutive same-topic blocks,
  pinned items preserved.
- **readiness**: share-weighted band + confidence level — never a bare number.

Config tunables live in `packages/engine/src/config.ts` — change behavior there,
not in services.

---

## 8. Operations runbook

```powershell
# DB
pnpm db:migrate:deploy     # apply migrations (prod: after backup + approval)
pnpm db:generate           # regenerate Prisma client (postinstall does this)
pnpm db:seed               # taxonomy/blueprints (idempotent)
pnpm db:seed-mcq-topics    # MCQ topic synonyms (idempotent)
pnpm db:seed-diagnostic    # curate diagnostic pool slice (idempotent)
pnpm db:bulk-publish       # ops: publish sourced drafts → practice/diagnostic/
                           #      reassessment pools (see warning below)

# Quality gates (run before every commit/PR)
pnpm lint && pnpm typecheck && pnpm build
pnpm --filter @aptiva/web test          # unit (vitest+jsdom)
pnpm --filter @aptiva/engine test
cd apps/api && NODE_ENV=test pnpm vitest run --config vitest.integration.config.ts
cd apps/web && pnpm exec playwright test   # needs dev stack + browsers installed

# Load / journey / replay
k6 run -e API_URL=... -e EMAIL=... -e PASSWORD=... -e QUESTION_IDS=qid:oid,... tools/k6/attempt-submit.js
node tools/e2e-journey.mjs             # API_URL env override
cd tools/replay && pnpm test
```

**⚠ bulk-publish caveat**: it records two-reviewer approvals under real
admin/reviewer accounts — compliant with the letter of the publish rule but
not a substitute for human review. Re-run only for new imports; it's idempotent.

**Background jobs** (BullMQ, Redis): attempt-stream consumer + reclaim +
dead-letter; diagnostic results; profile recalc; plan regen (inside recalc);
reassessment comparison (lazy + worker); privacy deletions + retention sweep
(daily schedulers via `upsertJobScheduler`). All degrade gracefully: Redis down →
attempts write direct-to-DB; recalc failure → `recalc_status=failed` + retry.

**Env flags worth knowing**: `RATE_LIMIT_FACTOR` (multiplies all limits — tests
only), `RECALC_QUEUE_NAME`/`PROFILE_QUEUE_NAME` (queue isolation in tests),
`EMAIL_API_KEY` (password-reset email — unverified in dev), `WEB_BASE_URL`
(reset links), `NOTICE_VERSION` (consent versioning), `NODE_ENV=production`
(strict errors, no stack traces).

---

## 9. Security model (details in docs/SECURITY.md)

- Argon2id hashing + HIBP breach check; generic login errors (no enumeration).
- JWT access (15 min) + rotating refresh tokens; **atomic revoke + family
  revocation on replay detection**; httpOnly cookie; `x-aptiva-client` header
  required on cookie-auth mutations (CSRF defense).
- Global guard chain: AuthGuard → RolesGuard → owner checks; T-020 test proves
  cross-user 404s and student→admin 403s.
- Answer keys: Redis-cached server-side; reveal endpoint only after the attempt
  row exists; submit responses carry no key material.
  Helmet CSP (API) + Next.js `headers()` (XFO DENY, nosniff, Referrer-Policy,
  Permissions-Policy, CSP).
- Rate limiting: in-memory fixed window per route/IP (single instance — needs
  Redis backing for multi-instance, PH-12 note).
- Audit log: auth events, admin access, privacy actions; 400-day retention.
- Privacy: export/delete/consent endpoints (§4.19); deletion job deletes after
  30 days; audit stores ids only.

---

## 10. Testing status (docs/TESTING.md has measured numbers)

- Integration **67/67** (auth, content, import, attempts/PH-4, diagnostic/PH-5,
  plans/PH-7, practice/PH-8, reassessment+privacy+authz/PH-9/10).
- Unit: engine 37, api ~40, web 14, ingest 24, replay 2.
- k6: submit p95 **104.6 ms** (<150 target), 0% failures at 10 VUs.
- axe: **0 violations** on 15 pages (WCAG 2.1 A/AA).
- Journey E2E: 16/17 (recalc poll raced a 260-job queue backlog — capacity note).

---

## 11. Known gaps & honest limitations

1. **Content depth is now decent but uneven**: ~1,381 practice + 200 diagnostic +
   164 reassessment published. DS-11/DS-12 are MCQ-heavy; DS-01 is numerical-only.
   Multi-answer word problems from DS-01 were rejected at import (9 files) — some
   borderline two-part items may remain; review before high-stakes use.
2. **Diagnostic composer is deterministic** — same student gets the same 12/27
   items (seeded shuffle). Diversifies as pools grow; randomization is future work.
3. **Diagnostic pool = curated slice**, approvals recorded by script — see §8 caveat.
4. **Email delivery unverified** — reset/verify flows exist; `EMAIL_API_KEY` must
   be configured and tested before pilot.
5. **No MFA**, no payment/billing (PH-13 backlog), no reminders, no Hindi UI.
6. **Single-instance assumptions**: in-memory rate limiter; BullMQ workers run
   inside the API process — fine for pilot scale, revisit for PH-12 multi-instance.
7. **Recalc throughput** ~6–7 sessions/s observed; backlog drains but consider
   worker concurrency if volume grows.
8. **Counsel review pending** for `docs/PRIVACY.md`; **ZAP baseline scan not yet
   run** — both are PH-10/12 pilot gates.
9. **Upload pipeline deferred** (E-022 optional) — if document upload is added,
   the Section-23 quarantine/scan chain applies.
10. **Deferred backlog** (PH-13): pilot evaluation, billing tiers, multi-target
    plans, streaks, external score log, pattern reports, reminders, Hindi,
    adaptive (information-based) diagnostic, IRT/BKT, ILP planner, LLM hints.

---

## 12. Conventions for new contributors

- **Phase-gated workflow** (from playbook): implement one phase, verify, write
  `docs/progress/phase-NN.md`, stop at the gate, wait for approval.
- **Never** put business logic in controllers — services + pure engine.
- Engine functions are pure TS — no I/O, fully unit-testable; keep them that way.
- Server-side marking/timing is non-negotiable; never return answer keys early.
- Prisma: edit `schema.prisma` → create migration → `db:migrate:deploy` →
  `db:generate`. Never edit `generated/`.
- DTOs are Zod schemas in each module's `dto.ts` (`parseBody` helper).
- Error codes are stable strings (`POOL_EXHAUSTED`, `REAUTH_REQUIRED`,
  `PUBLISH_RULES`, `NO_REQUIREMENTS`, `DIAGNOSTIC_COMPLETED`…) — UI branches on them.
- `exactOptionalPropertyTypes` is ON — optional fields need `| undefined` in types.
- Pre-commit runs eslint --fix + prettier on staged files.
- Integration tests need `NODE_ENV=test` + real PG/Redis (docker compose up).
- Commit style: short imperative subject; phases get `PH-N: …` headers.

---

## 13. Where to start if you're adding a feature

1. Read the relevant `docs/progress/phase-NN.md` for how the area was built.
2. Engine change? → `packages/engine` + unit test first, then wire into services.
3. API change? → module `dto.ts` → service → controller → integration test.
4. UI change? → `src/lib/*` client fn → page/component → check nav wiring.
5. Content change? → ingestion source in `tools/ingest` or admin import UI →
   drafts → review → publish (respect pool rules).
6. Run the quality gates in §8 before committing.
