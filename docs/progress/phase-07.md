# Phase 7 — Requirements, planner and first plan (M1)

Status: **complete** — verified 2026-11-12.

## Scope delivered

| Task                         | Result                                                                                                                                                                                                                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PH7-T01 migrations           | `preparation_requirements`, `practice_plans`, `practice_plan_items`, `plan_change_log`, `readiness_estimates` — migration `20261112100000_planner`, Prisma models + relations, expand-only                                                                                                       |
| PH7-T02 E-021                | `GET/PUT /me/requirements` — zod schema + service rules: future testDate, deadline ≤ testDate, weekday minutes 0 or ≥10, block length ∈ {15,30,45,60,90}; active-row swap in a transaction; wanted topics accept slugs or ids                                                                    |
| PH7-T03 blueprint resolution | assessment-specific current version when set, else `generic` assessment; per-section duration weighting → global shares; weakest-source provenance (`sourceType`/`confidence`) carried into rationale + readiness; `blueprintUnverified` flag on generic/fallback                                |
| PH7-T04 engine               | `priority.ts` (gap×blueprint×urgency×error×evidence), `candidates.ts` (9 block types), `planner.ts` (0/1 knapsack per day, 250 ms deadline, deterministic greedy fallback, exact-minute repair, ≤2 consecutive topic rule), `readiness.ts` (share-weighted p(correct at pace) band + confidence) |
| PH7-T05 E-030/31/32/33/36    | `POST /me/plans` (409 `NO_REQUIREMENTS`), `GET /me/plans/current`, `GET …/rationale`, `GET …/changes`, `GET /me/readiness` (live-computes + persists when missing)                                                                                                                               |
| PH7-T06 UI                   | P-11 `/setup/requirements` form, P-12 `/plan` day cards + `WhyThisPanel` + `ReadinessBand` + change history                                                                                                                                                                                      |
| PH7-T07                      | first plan auto-generated inside `PUT /me/requirements` (trigger `setup`, change-log entry written)                                                                                                                                                                                              |

## Bugs found & fixed during verification

1. **Knapsack DP indexing** — `dp` was a 1-D array indexed as 2-D, so only the first candidate was ever evaluated → every day degenerated to one topic + filler. Rewrote as a real 2-D table with DP-walk reconstruction. Caught by live smoke (plan showed 1 topic); engine unit tests hadn't covered multi-candidate selection value.
2. **Profile topics invisible to planner** — topics measured by the diagnostic but absent from blueprint weights got `shareNorm=0` → target below proficiency → priority 0 → never planned. Added `PROFILE_TOPIC_SHARE_NORM_FLOOR=0.5` so profiled topics keep a baseline target; verified live (plan went from 1 topic/60 items to 6 topics/124 items).
3. **Stale Prisma relation names** — `PlanChangeLog`↔`PracticePlan` has two relations; named them explicitly.

## Verification

| Check                    | Result                                                                                                                             |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Engine unit              | **36/36** (incl. T-ML-05 priorities, T-ML-06 properties, T-ML-07 deadline→fallback <300 ms, T-ML-08 golden-ish, T-ML-12 readiness) |
| API integration          | plans suite **5/5** (T-012 validation, T-013 45-vs-15 budgets, E-030..E-036); **full suite 61/61**                                 |
| lint / typecheck / build | clean; 21 web routes incl. `/setup/requirements`                                                                                   |
| Live E2E                 | `mcqtest` PUT requirements → auto plan (knapsack, 124 items, 6 topics, per-day sums exact) → readiness 23–73% low-confidence band  |

## Honest limitations (documented)

- **Block-type monotony under thin evidence**: every topic with <15 attempts becomes a `probe` — spec-correct but plans look repetitive until practice accumulates.
- **Readiness paceRatio** is not yet fed (needs per-question expected time vs `timeEmaMs` plumbing); band still works on rating/RD/evidence.
- **E-034 restore / E-035 plan-settings** deferred (P1/later per playbook); `plan_change_log.restored_from` column exists for PH-8+.
- **Idempotency-Key** on E-030 accepted but not deduplicated (regeneration is itself idempotent-ish: always supersedes current).
- **Document upload** deferred to PH-13 per playbook.
- Filler `short_review` items appear when leftover budget can't fit a whole candidate — documented engine behaviour for exact sums.

## Files

- Engine: `packages/engine/src/{priority,candidates,planner,readiness}.ts`, `config.ts`, `index.ts`, `test/planner.test.ts`
- API: `apps/api/src/plans/{dto,plans.service,plans.controller,plans.module}.ts`, `app.module.ts`
- Web: `components/{RequirementsForm,WhyThisPanel,ReadinessBand}.tsx`, `lib/content.ts`, `app/(student)/setup/requirements/page.tsx`, `app/(student)/plan/page.tsx`
- DB: `prisma/schema.prisma`, `prisma/migrations/20261112100000_planner/`
- Tests: `apps/api/test/integration/plans.int.test.ts`
