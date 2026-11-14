# Project status

Task tracking per playbook Sections 34–37. Task IDs are stable; statuses:
not started, in progress, blocked, done.

| Task    | Description                                                                                         | Status | Phase |
| ------- | --------------------------------------------------------------------------------------------------- | ------ | ----- |
| PH0-T01 | Look up versions, check peers, pin, record                                                          | done   | PH-0  |
| PH0-T02 | Monorepo layout (Section 31) with empty modules                                                     | done   | PH-0  |
| PH0-T03 | docker-compose, .env.example, typed config module                                                   | done   | PH-0  |
| PH0-T04 | Prisma baseline migration (extensions); /health /ready                                              | done   | PH-0  |
| PH0-T05 | Lint, format, typecheck, test runners, pre-commit                                                   | done   | PH-0  |
| PH0-T06 | CI workflow                                                                                         | done   | PH-0  |
| PH0-T07 | README, docs/STATUS.md, docs skeleton                                                               | done   | PH-0  |
| PH1-T01 | Identity migrations and Prisma models                                                               | done   | PH-1  |
| PH1-T02 | E-001 to E-007 auth endpoints                                                                       | done   | PH-1  |
| PH1-T03 | Auth/role/rate-limit guards                                                                         | done   | PH-1  |
| PH1-T04 | Audit-log writer                                                                                    | done   | PH-1  |
| PH1-T05 | Auth pages, shells, route guards, API client                                                        | done   | PH-1  |
| PH1-T06 | Consent notice versioning                                                                           | done   | PH-1  |
| PH2-T01 | Content migrations (taxonomy, blueprints, questions, reviews, lessons, error_types, import_batches) | done   | PH-2  |
| PH2-T02 | Seed taxonomy, error_types, fallback + sample blueprint                                             | done   | PH-2  |
| PH2-T03 | Engine markAttempt (MCQ + numerical tolerance/rounding)                                             | done   | PH-2  |
| PH2-T04 | Admin APIs E-060/61/64/65 with validation, sanitisation, publish rules                              | done   | PH-2  |
| PH2-T05 | Public APIs E-055/E-056                                                                             | done   | PH-2  |
| PH2-T06 | Frontend P-01/P-02 + admin P-20/P-21/P-23/P-24 with KaTeX                                           | done   | PH-2  |
| PH2-T07 | Generic fallback + seeded sample blueprint with provenance                                          | done   | PH-2  |

| PH3-T01 | tools/ingest common pipeline (fetch pinned, parse, classify, validate, dedupe) | done | PH-3 |
| PH3-T02 | DS-01 markdown parser (numerical single-answer) | done | PH-3 |
| PH3-T03 | DS-02 parser — blocked (D-01, no approved non-Kaggle dataset) | blocked| PH-3 |
| PH3-T04 | DS-03 GSM8K numerical parser | done | PH-3 |
| PH3-T05 | E-062/E-063 import APIs + P-22 import UI | done | PH-3 |
| PH3-T06 | Coverage report (topic x band x pool vs threshold) | done | PH-3 |
| PH3-T07 | DS-07 company pattern extractor -> company_pattern_records | done | PH-3 |
| PH3-T08 | DS-08 coverage/topic-emphasis list (no question import) | done | PH-3 |
| PH3-T09 | Topic synonyms + mapper + E-067/68/69 review queue | done | PH-3 |
| PH3-T10 | Blueprint drafter (provenance, conflicts, assumptions) + P-23 draft action | done | PH-3 |
| PH3-T11 | Fit job -> question_assessment_tags (recomputable, 0-1) | done | PH-3 |

| PH4-T01 | Migrations practice_sessions, question_attempts | done | PH-4 |
| PH4-T02 | AttemptService: ownership, server timestamps, cached keys, marking, idempotency | done | PH-4 |
| PH4-T03 | Redis Stream producer/consumer group, batch insert, backoff, dead-letter, pending reclaim | done | PH-4 |
| PH4-T04 | Degraded mode: direct DB write on stream failure; 503 when both fail | done | PH-4 |
| PH4-T05 | Flush barrier with client id-list reconciliation | done | PH-4 |
| PH4-T06 | E-040/41/42 session endpoints (finish → 202 + recalc job) | done | PH-4 |
| PH4-T07 | k6 submission-path script | done | PH-4 |

| PH5-T01 | Migrations diagnostic_tests, diagnostic_results + feedback tables | done | PH-5 |
| PH5-T02 | Diagnostic composer (27 std / 12 express, 4 sections, 30/45/25 bands, disjoint pools) + db:seed-diagnostic | done | PH-5 |
| PH5-T03 | E-010..E-014 diagnostic lifecycle, single pause, 48h partial rule, flush barrier | done | PH-5 |
| PH5-T04 | analyzeDiagnostic engine + E-015 result endpoint (coarse flag, thin evidence) | done | PH-5 |
| PH5-T05 | inferError engine + E-016 feedback (reported wins, conflict flag) | done | PH-5 |
| PH5-T06 | UI P-06..P-09 + ErrorCausePicker/ConflictNote + Playwright keyboard spec | done | PH-5 |

| PH6-T01 | Migrations student_topic_profiles, profile_snapshots | done | PH-6 |
| PH6-T02 | Engine config.ts, rating.ts (Glicko-1), ema.ts | done | PH-6 |
| PH6-T03 | profileFromAttempts: ratings, intervals, EMAs, error mix, labels, thin-evidence | done | PH-6 |
| PH6-T04 | Post-submit profile job after flush barrier; idempotent baseline snapshot | done | PH-6 |
| PH6-T05 | E-020 /me/profile + history; P-10 ProfileRadar/TopicTable UI | done | PH-6 |
| PH6-T06 | Question elo_rating small-step updates (min 30 responses) | done | PH-6 |
| PH6-T07 | tools/replay: log loss, Brier, interval coverage on synthetic data | done | PH-6 |

| PH7-T01 | Migrations preparation_requirements, practice_plans(+items), plan_change_log, readiness_estimates | done | PH-7 |
| PH7-T02 | E-021 GET/PUT /me/requirements with T-012 validation | done | PH-7 |
| PH7-T03 | Blueprint resolution: assessment-specific vs generic fallback + provenance | done | PH-7 |
| PH7-T04 | Engine priority/candidates/planner(0-1 knapsack+fallback)/readiness | done | PH-7 |
| PH7-T05 | E-030/31/32/33/36 plan endpoints + auto first plan | done | PH-7 |
| PH7-T06 | UI P-11 requirements form + P-12 plan page + WhyThisPanel + ReadinessBand | done | PH-7 |
| PH7-T07 | Automatic first-plan generation on requirements save | done | PH-7 |

| PH8-T01 | Session start from plan block; next-question selection (unseen, diff step, topic cap) | done | PH-8 |
| PH8-T02 | P-14 runner: MCQ+numeric, timer, instant feedback, reveal endpoint, cause chips | done | PH-8 |
| PH8-T03 | Recalc job: profiles+snapshot+readiness+future-day plan regen+top-3 change log | done | PH-8 |
| PH8-T04 | E-043 summary + P-15 polling UI + neutral retry | done | PH-8 |
| PH8-T05 | P-13 dashboard: readiness, today, priorities, what changed | done | PH-8 |
| PH8-T06 | Mistake notebook E-044 + P-17 + 1/3/7/14d retry ladder | done | PH-8 |
| PH8-T07 | Concept-repair lesson gate before targeted questions | done | PH-8 |

| PH9-T01 | Reassessment builder E-050 using unseen items from same topic/difficulty cells | done | PH-9 |
| PH9-T02 | Comparison E-051 with noise labels and retention checks | done | PH-9 |
| PH9-T03 | UI P-18 reassessment runner and comparison view | done | PH-9 |
| PH9-T04 | Re-plan when time, dates, or targets change: compress, no backlog | done | PH-9 |
| PH9-T05 | Cram mode for last 48 hours: speed drills and formula review | done | PH-9 |
| PH9-T06 | Plan history, restore, pins and keep-my-plan setting (E-033..35, P-16) | done | PH-9 |
| PH9-T07 | Block feedback: already know this, too easy, not relevant | done | PH-9 |

| PH10-T01 | Export, delete and consent withdrawal (E-070..72, P-19) with re-auth | done | PH-10 |
| PH10-T02 | Security headers, CSP, CORS allow-list, cookie review | done | PH-10 |
| PH10-T03 | Complete authorization matrix (every route by role and owner) | done | PH-10 |
| PH10-T04 | Upload security chain (deferred - no uploads in MVP) | done | PH-10 |
| PH10-T05 | Failure and degraded-mode tests from Section 23 | done | PH-10 |
| PH10-T06 | Audit logging of admin access and support elevation | done | PH-10 |
| PH10-T07 | Dependency audit fixes (`pnpm audit --prod` clean) | done | PH-10 |
| PH10-T08 | Draft privacy notice and consent text for review by counsel | done | PH-10 |
| PH10-T09 | Retention jobs (auth tokens, audit logs, soft-deleted accounts) | done | PH-10 |

| PH11-T01 | End-to-end test of the 12-step journey (17/17 steps passed) | done | PH-11 |
| PH11-T02 | k6 load test at NFR-008 target (p95=40ms < 150ms, 0% failures) | done | PH-11 |
| PH11-T03 | Query review with EXPLAIN on dashboard, plan, and result paths | done | PH-11 |
| PH11-T04 | axe scan (15 pages, 0 violations) and keyboard navigation pass | done | PH-11 |
| PH11-T05 | Responsive and browser matrix (mobile/tablet/desktop passed) | done | PH-11 |
| PH11-T06 | Engine replay evaluation on synthetic and seeded data | done | PH-11 |
| PH11-T07 | Defect burn-down (67/67 integration tests passing) | done | PH-11 |

| PH12-T01 | Provision staging and production (Dockerfiles, prod compose, Caddy) | done | PH-12 |
| PH12-T02 | Deployment pipeline with manual approval gate (release.yml) | done | PH-12 |
| PH12-T03 | Domain, DNS, HTTPS, HSTS and reverse proxy configuration | done | PH-12 |
| PH12-T04 | Secrets in host stores documentation (.env.production.example) | done | PH-12 |
| PH12-T05 | Monitoring, alerts, and health probes (docs/MONITORING.md) | done | PH-12 |
| PH12-T06 | Backup and restore rehearsal (100% data fidelity verified) | done | PH-12 |
| PH12-T07 | Operational runbook (docs/RUNBOOK.md) and release notes | done | PH-12 |
| PH12-T08 | robots.txt, sitemap.xml, noindex on private routes | done | PH-12 |
| PH12-T09 | Production smoke test (15/15 pass) and first admin creator | done | PH-12 |
| PH12-T10 | Pilot readiness review against Section 38 (docs/PILOT_READINESS.md) | done | PH-12 |
| PH13-T01 | Pilot evaluation runner and cohort analysis module (tools/pilot-eval.ts) | done | PH-13 |
| PH13-T02 | Billing and tiers (Free, Sprint Pass, Season Pass, idempotent webhook) | done | PH-13 |
| PH13-T03 | Multiple targets with date and priority split (blendBlueprints & requirements) | done | PH-13 |
| PH13-T04 | Commitment streak with rest day and neutral wording (/me/commitment) | done | PH-13 |
| PH13-T05 | External score log (manual entry and CSV upload) (/me/external-scores) | done | PH-13 |
| PH13-T06 | Company pattern reports (structure-only) and drift alerts | done | PH-13 |
| PH13-T07 | Reminders and weekly summary preferences (/me/notifications) | done | PH-13 |
| PH13-T08 | Hindi and regional language interface support (packages/shared/src/i18n) | done | PH-13 |

Phase detail and verification evidence: `docs/progress/phase-00.md`,
`docs/progress/phase-01.md`, `docs/progress/phase-02.md`, `docs/progress/phase-03.md`, `docs/progress/phase-04.md`, `docs/progress/phase-05.md`, `docs/progress/phase-06.md`, `docs/progress/phase-07.md`, `docs/progress/phase-08.md`, `docs/progress/phase-09.md`, `docs/progress/phase-10.md`, `docs/progress/phase-11.md`, `docs/progress/phase-12.md`, `docs/progress/phase-13.md`.

## Open decisions (playbook Section 40.2)

| ID     | Decision                    | Status                                                            |
| ------ | --------------------------- | ----------------------------------------------------------------- |
| D-01   | Which Kaggle dataset        | Open — team will not provide one; DS-01 GitHub repo is the source |
| D-05   | Hosting provider and budget | Resolved — Docker compose / VPS with Caddy auto-HTTPS & PaaS docs |
| others | See playbook Section 40.2   | Defaults apply unless flagged                                     |

## Known issues / limitations

- Docker Desktop is installed and `infra/docker-compose.yml` services
  (PostgreSQL 18, Redis 8) run locally; migrations, seed and the full
  integration suite execute on this machine.
- `@aptiva/ingest` must be built (`pnpm --filter @aptiva/ingest build`) before the API runs/tests — root scripts do this automatically; `nest start --watch` does not reload workspace deps, restart after ingest changes.
- `pnpm build` runs both apps in parallel and can hit a transient native
  OOM on memory-constrained machines (~1 GB free); run the per-app builds
  sequentially if it recurs.
