# PH-6 — Estimation engine and baseline profile

Status: **complete** — verified 2026-11-12.

## Scope delivered

| Task    | Deliverable                                                                                                                                                                                                                                             |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PH6-T01 | Migration `20261112090000_profile`: `student_topic_profiles` + `profile_snapshots` per playbook 12.1 DDL; Prisma models added                                                                                                                           |
| PH6-T02 | `packages/engine/src/config.ts` (all tunables with notes), `rating.ts` (Glicko-1 update), `ema.ts`                                                                                                                                                      |
| PH6-T03 | `profile.ts` — `profileFromAttempts`: per-topic rating/RD/interval, EMAs, attempt count, session count, reported vs inferred error mix, Weak/Moderate/Strong label, thin-evidence flag (<15 attempts or <2 sessions)                                    |
| PH6-T04 | `apps/api/src/profile/` — `ProfileJobService` (BullMQ `aptiva-profile-recalc`), enqueued by the diagnostic result job after the flush barrier; `ProfileService.recomputeBaseline` idempotent by diagnostic id; baseline snapshot `is_baseline=true`     |
| PH6-T05 | E-020 `GET /me/profile` + `GET /me/profile/history`; P-10 `/profile` UI — `ProfileRadar` (section means), `TopicTable` (sortable: estimate range, items, accuracy EMA, error mix, early-estimate badge), baseline snapshot card, comparison placeholder |
| PH6-T06 | `refreshQuestionRatings` — questions with ≥30 responses get a blended `elo_rating` update (question vs fixed 1500/300 student prior, 25% blend)                                                                                                         |
| PH6-T07 | `tools/replay` — `replayAttempts` (prequential log loss, Brier, interval coverage, MAE) + `syntheticAttempts`; smoke test on 240 synthetic attempts                                                                                                     |

## Engine constants (handover)

- Rating prior **1500**, RD prior **300**, RD floor **30**; Glicko-1 update with q=ln10/400; step ∝ RD′² so swings shrink with evidence.
- EMA α=**0.30** for accuracy and time.
- Labels: rating <1350 weak, >1650 strong, wide RD (>200) always moderate.
- Thin evidence: <15 answered attempts **or** <2 distinct contexts → "Early estimate" badge.
- Question rating updates: min **30** responses, 25% blend toward observed.
- `engine_version` stored on every snapshot (`ENGINE_VERSION` from packages/engine).

## Known simplifications

- Glicko-1 (not full Glicko-2 volatility iteration); single-game updates only.
- "Interval coverage" in replay is a probability-band proxy, not a calibrated coverage measure — ML-E2 needs real pilot data.
- Question RD is a fixed 300 fallback until per-question RD tracking exists.
- `error_mix` aggregates reported (student label) and inferred (rule) counts separately; no per-type confidence weighting yet.
- Baseline comparison UI is a placeholder (PH-9 reassessment owns real diffs).
- Stream poison-pill note: attempts referencing deleted questions stay pending until MAX_DELIVERIES dead-letters them (~5 reclaim cycles); integration suite now clears orphans in `beforeAll`.

## Verification

- Engine: **29/29** (T-ML-01 rating direction/RD floor/shrinking step; T-ML-02 EMA init+weight; profileFromAttempts aggregation/thin flag/interval).
- API unit **39/39**, web **14/14**, ingest **24/24**, replay **2/2**, shared **4/4**.
- Integration **56/56** incl. new `profile.int.test.ts` (5): real submit → result job → profile job → profiles+snapshot; idempotent recompute; E-020 endpoints.
- lint / typecheck / build clean (22 routes).
- Live: `mcqtest@example.com` diagnostic → `/me/profile` returns 5 topics across di/quant/reasoning/verbal with intervals, counts, baseline snapshot.

## Infra incident (resolved)

Docker Desktop restarted postgres/redis containers overnight; the published-port proxy went stale (TCP accept, write ECONNABORTED). `docker compose restart redis postgres` restored connectivity. Integration tests must run with `NODE_ENV=test` (vitest default) — sourcing `apps/api/.env` exports `NODE_ENV=development`, which enables the stream consumer and breaks the degraded-mode tests.

## Prerequisite note

DS-11/DS-12 MCQ ingestion landed in the same session (commit `350ad2d`): 1,667 MCQs imported as drafts, taxonomy extended (+19 topics, +82 synonyms), diagnostic pool re-curated to 4 sections / 36 MCQ + 4 numerical. Diagnostics now serve MCQs across all sections.
