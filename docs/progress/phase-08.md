# Phase 8 — Practice runner and daily loop (M2)

## Scope delivered

| Task                                                   | Status | Evidence                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PH8-T01 session start from plan block + item selection | done   | `practice_sessions.topic_id/block_type` columns; `POST /sessions` resolves `planItemId` → topic/block/minutes; `GET /sessions/:id/next` picks unseen-first, difficulty step ≤1 band, topic-share cap, pool-exhausted fallback                                                                                                                                                 |
| PH8-T02 runner UI P-14                                 | done   | `/practice/session/[id]` — MCQ + numeric input, display timer, instant feedback, post-attempt reveal endpoint, one-tap `ErrorCausePicker` on wrong answers                                                                                                                                                                                                                    |
| PH8-T03 finish → recalc job                            | done   | `RecalcService` worker: per-user advisory lock → `ProfileService.recomputeSession` (all attempts → profiles + `session` snapshot) → `PlansService.regenerateFutureDays` (future days only, carried items preserved, top-3 change log) → readiness estimate → CAS `recalc_status`; 3 retries exponential backoff; final failure → `failed` + `POST /sessions/:id/recalc-retry` |
| PH8-T04 E-043 + P-15                                   | done   | `GET /sessions/:id/summary` (counts, accuracy, pace, per-topic); `/practice/session/[id]/summary` polls every 2 s until done/failed; neutral retry banner                                                                                                                                                                                                                     |
| PH8-T05 dashboard P-13                                 | done   | ReadinessBand, today's plan, priority ranking (top rationale.priority), maintenance/low-priority list, WhatChangedCard from latest change log                                                                                                                                                                                                                                 |
| PH8-T06 mistake notebook                               | done   | `mistake_entries` table + lazy resolution (later correct attempt on same topic closes entry); wrong answers auto-recorded with retry ladder 1/3/7/14 days; `GET /me/notebook` + `/notebook` UI with open/resolved/all filters                                                                                                                                                 |
| PH8-T07 concept-repair lessons                         | done   | `concept_repair` blocks return `{type:'lesson'}` once before questions when a published lesson exists for the topic                                                                                                                                                                                                                                                           |

## Verification

- Integration: `practice.int.test.ts` — **T-015 daily loop passes** (session → 3 attempts → finish 202 → recalc done → new planId, session snapshot, readiness estimate, change-log entry with top-3 changes, notebook endpoint). Full suite **63/63**.
- Unit: api 39, engine 36, web 14 — all pass. Lint clean. Typecheck clean. Build clean (27 routes incl. `/practice`, `/practice/session/[id]`, `/practice/session/[id]/summary`, `/notebook`).
- Live smoke pending manual pass (servers running: web :3000, api :4000).

## Notable decisions / deviations

- **Answer-key secrecy preserved**: E-041 response keeps the spec shape (no key material). Instant feedback uses a separate `GET /sessions/:id/attempts/:attemptId/reveal` that only resolves after the attempt row exists — the existing SEC-010 test still passes.
- **Queue isolation**: `RECALC_QUEUE_NAME`/`PROFILE_QUEUE_NAME` env overrides added — a concurrently running dev API was stealing test jobs and running the PH-4 placeholder (marked `done` without writing profiles). Tests now use pid-scoped queue names.
- **Nested transactions**: `recomputeSession`/`regenerateFutureDays` use their own `prisma` client inside the worker's advisory-lock transaction; each step has independent idempotency markers (snapshot `data.sessionId`, change-log `summary.sessionId`) so a mid-pipeline retry converges.
- **Sparse practice pool**: only ~50 published `practice`-pool questions exist; `next` widens topic→whole-pool and returns `done: pool_exhausted` rather than dead-ending. Practice depth remains a content blocker (documented).
- **Lesson gate**: shown once per session via Redis flag; if Redis is down the gate is skipped (practice never blocked).

## Handover notes

- Recalc contract: job `{sessionId, userId}` on `aptiva-recalc`; status read via E-043 `recalcStatus` (`none|pending|done|failed`).
- Retry policy: BullMQ `attempts: 3`, exponential backoff 1 s; final failure flips `recalc_status` to `failed`.
- Dashboard data sources: `GET /me/readiness`, `GET /me/plans/current` (+`/changes`), `GET /me/profile`.
