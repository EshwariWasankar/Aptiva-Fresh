# PH-9 — Reassessment and adaptive features

Status: **complete** (2026-11-12)

## Delivered

- **E-050 `POST /me/reassessments`** — kinds `check` (10q/10m), `topic` (15q/15m, requires `topicId`), `mock` (30q/30m). Counts unseen published `reassessment`-pool items; `409 POOL_EXHAUSTED` at zero, `shortened: true` + adjusted minutes when the pool is thin. Session kinds `check`/`topic_test`/`mock` reuse the PH-4 runner; `KIND_POOL` now routes all three to the disjoint `reassessment` pool (DATA-003).
- **E-051 `GET /me/reassessments/:id/comparison`** — lazily computes and caches in `reassessment_results` (unique session): baseline-vs-now rating deltas per attempted topic, noise labels (`too_early_to_tell` when |Δ| ≤ ½ combined RD), accuracy EMA comparison, retention (`retained`/`decayed`), session accuracy.
- **P-18 UI** — `/reassessment` kind picker + topic selector + pool-shortfall notice; `/reassessment/[id]` comparison table; summary page links to comparison for non-practice kinds.
- **PH9-T04 re-plan** — regeneration already emits future days only (no backlog); `POST /me/plans` regenerates on demand.
- **PH9-T05 cram mode** — `daysLeft <= 2` restricts candidates to `speed_drill`, `formula_revision`, `short_review`, `timed_set`, `mixed_check`, `maintenance`, `probe` — no `concept_repair`/`targeted_practice` (new heavy concepts). Engine test added.
- **PH9-T06 history/restore/settings** — `GET /me/plans` (version list), `GET /me/plans/:planId`, `POST /me/plans/:planId/restore` (E-034: carries today/past items, restores future days, change-log trigger `restore`), `GET/PUT /me/plan-settings` (E-035: `keepMyPlan`, `pins`, `reminderLimits`; `users.plan_settings` JSONB). `keepMyPlan` skips auto-regen in the recalc worker while profiles/snapshots/readiness still update. **P-16** `/plan/history` — version table, compare (per-topic minutes), restore.
- **PH9-T07 block feedback** — `POST /me/plans/:planId/items/:itemId/feedback` (`already_know`/`too_easy`/`not_relevant` + note) appended to item rationale; `too_easy`/`not_relevant` suppress the topic from new candidates for 14 days.

## Tests

- T-016 lifecycle (start → answer → finish → recalc → cached comparison) — pass.
- Pool exhaustion 409 — pass.
- Engine cram test — pass (37/37 engine).
- Full integration **67/67**.

## Known gaps

- Reassessment pool depth is the binding constraint (4 published items today); bank growth needed for meaningful mocks.
- `pins` stored both in `plan_settings.pins` and per-item `pinned` flag (items win at read time).
- Missed-day "compress" is implicit (future-days-only regen); an explicit compress-budgets mode is future work.
