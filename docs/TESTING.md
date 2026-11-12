# Testing & performance report — PH-11 (measured, local stack)

Environment: Windows dev machine, NestJS `nest start --watch`, Next.js dev server,
PostgreSQL + Redis in Docker Compose, single API instance, `RATE_LIMIT_FACTOR=50`
for load testing (production default is 1). All numbers below are **measured**,
not targets.

## T01 — Student journey E2E (`tools/e2e-journey.mjs`)

Scripted API journey: register → requirements (60 min/day) → auto-plan →
requirements change to 20 min/day → re-plan → session → answers → finish →
recalc → notebook/profile/readiness → plan history → keep-my-plan →
reassessment → export.

**Result: 16/17 steps pass.** The one miss was `recalc completes` inside a
30 s poll — the finish enqueued correctly (`recalc_status=pending`) but the
BullMQ worker was ~260 jobs deep after the k6 run (≈6–7 jobs/s drain). The
session later reached `done`. No data loss; this is queue depth, not failure.

- 60→20 min re-plan verified: day-0 block minutes sum = **20**, no backlog.
- Plan history shows both versions; restore/settings/export all pass.

## T02 — Load test (k6 v0.54.0, `tools/k6/attempt-submit.js`)

10 VUs, 50 s, full session→attempt→finish cycle per iteration, rotating
across 10 real MCQ fixtures (`QUESTION_IDS`).

| Metric             | Measured                  | Target             | Verdict |
| ------------------ | ------------------------- | ------------------ | ------- |
| Attempt submit p95 | **104.6 ms**              | < 150 ms (NFR-003) | ✅      |
| Submit avg / p90   | 65.4 / 96.3 ms            | —                  | —       |
| HTTP req p95       | 93.1 ms                   | —                  | —       |
| Failed requests    | **0.00 %** (0 / 3,505)    | < 1 %              | ✅      |
| Iterations         | 1,168 full cycles (~23/s) | —                  | —       |

Earlier runs exposed two real issues, both fixed:

- Default rate limit (600/min/IP) correctly rejected the flood with 429s —
  load test rerun with `RATE_LIMIT_FACTOR=50`.
- A stale API process held :4000 after shell kill; orphaned `node` must be
  killed by PID (`taskkill //PID <pid> //F`) — ops note for PH-12.

## T03 — Query review (EXPLAIN ANALYZE)

| Query                    | Plan                                                                 | Time    |
| ------------------------ | -------------------------------------------------------------------- | ------- |
| attempts by `context_id` | index scan `idx_attempts_context`                                    | 0.52 ms |
| current plan + items     | seq scan on tiny `practice_plans` + bitmap `idx_plan_items_plan_day` | 0.49 ms |
| topic profiles by user   | seq scan (10 rows)                                                   | 0.13 ms |

**Index added**: `idx_plans_user_current (user_id, is_current)` — the
`is_current` lookup is on the dashboard/plan hot path and will matter as
plan history grows. Migration `20261112140000_plan_user_current_idx`.

## T04 — Accessibility (axe-core via Playwright)

`e2e/axe-scan.spec.ts` scans **15 pages** (5 public + 10 student) with
WCAG 2.1 A/AA rules. **0 violations** after fixes:

- color-contrast: footer/step labels `neutral-400→500`, assessments page
  provenance text, header email `slate-500→400` on dark nav.
- label (critical): `PasswordInput` gained `aria-label` — settings page
  password fields were unlabeled.
- Next.js dev-tools overlay excluded (`nextjs-portal`) — dev chrome only.

Keyboard pass: `e2e/diagnostic-keyboard.spec.ts` (T-004) covers the
diagnostic flow keyboard-only. Manual screen-reader pass still recommended
before pilot (no SR automation in repo).

## T06 — Engine replay (`tools/replay`)

3,000 synthetic attempts, 3 topics, upward skill drift:
`logLoss=0.598, brier=0.207, intervalCoverage=0.815, meanAbsError=0.419`.
Replay tool tests 2/2 pass. Real-attempt replay awaits pilot data.

## Suite totals (this run)

- Integration: **67/67** · Unit: api, engine 37, web 14, ingest 24, replay 2
- lint / typecheck / build: clean (25 web routes)
- `pnpm audit --prod`: clean

## Known limits / capacity notes

- Single-instance rate limiter is in-memory (documented for PH-12 multi-instance).
- Recalc worker drains ~6–7 sessions/s; k6 produced a temporary backlog.
  Consider concurrency >1 or batching if session volume grows.
- Load test used one user; multi-user contention on shared questions untested.
- axe covers automated rules only; manual SR + real-device pass pending.
