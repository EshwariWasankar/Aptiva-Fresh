# PH-12 — Deployment and release

Status: **complete** (2026-11-14)

Production infrastructure, container packaging, release pipelines, SEO privacy configurations, operational runbooks, and pilot readiness acceptance delivered.

---

## Delivered Tasks & Evidence

### PH12-T01: Staging & Production Provisioning

- Multi-stage production containerization:
  - `apps/api/Dockerfile`: Node 22-alpine multi-stage build, non-root `nestjs` user, Prisma client generation, compiled NestJS distribution.
  - `apps/web/Dockerfile`: Node 22-alpine multi-stage build, non-root `nextjs` user, webpack build optimization.
  - `infra/docker-compose.prod.yml`: Orchestrates `postgres:17-alpine` (healthcheck, persistent volume), `redis:8-alpine` (AOF persistence), `api:4000`, `worker:4001` (Redis Streams and BullMQ consumer), `web:3000`, and `caddy:2-alpine` reverse proxy.
  - `infra/Caddyfile`: Reverse proxy routing, automatic HTTPS/TLS certificate management, HTTP/2 + HTTP/3 support, strict HSTS, zstd/gzip compression, and `/api/*` forwarding.

### PH12-T02: Deployment Pipeline with Manual Approval Gate

- `.github/workflows/release.yml`:
  - Automated build & test validation on all pushes.
  - Continuous deployment to staging on merge to `main`.
  - Manual approval gate in GitHub environment (`production`) for tagged releases (`v*.*.*`).
  - Pre-flight database backup, expand-only database migration deployment, service readiness verification, and smoke test execution.

### PH12-T03: Domain, DNS, HTTPS & Ingress

- Reverse proxy configuration with apex and subdomain routing, automated SSL/TLS via Let's Encrypt / ZeroSSL, HSTS (`max-age=31536000; includeSubDomains; preload`), and strict CSP headers.

### PH12-T04: Secrets Management in Host Stores

- `.env.production.example` created with explicit documentation of all production secrets, minimum entropy requirements, and instructions for host secret managers (AWS SSM, Render/Railway Env, Docker Secrets).

### PH12-T05: Monitoring, Alerts & Health Probes

- `docs/MONITORING.md` created:
  - Liveness probe: `GET /api/v1/health`
  - Readiness probe: `GET /api/v1/ready` (evaluates PostgreSQL connection and Redis ping)
  - Ingress probe: `GET /caddy-health`
  - Defined alerting rules for latency spikes ($p95 > 150\text{ ms}$), error rates ($> 1\%$), consumer stream lag ($> 2,000$ items), and dead-letter queue growth.

### PH12-T06: Backup and Restore Rehearsal

- `tools/db-backup.sh`: PostgreSQL custom compressed dump with sha256 checksum generation.
- `tools/db-restore.sh`: Clean target restoration script.
- `tools/rehearse-backup.sh`: Automated rehearsal script executed against live PostgreSQL instance:
  - Backed up live database (`aptiva`).
  - Created temporary scratch database (`aptiva_scratch_restore`).
  - Restored archive into scratch database.
  - Verified row counts across tables (`users`: 54, `topics`: 78, `questions`: 1,748, `question_options`: 7,813, `assessments`: 5, `practice_plans`: 8, `practice_plan_items`: 502, `practice_sessions`: 1,670, `question_attempts`: 1,689) with **100% data fidelity**.
  - Cleaned up scratch database.

### PH12-T07: Operational Runbook & Release Notes

- `docs/RUNBOOK.md`: Comprehensive guide for zero-downtime deployment, forward-fix migration policy, rollback drill procedures, disaster recovery restoration, and placement drive season scaling.
- `docs/RELEASE_NOTES.md`: Initial production release notes for Aptiva `v1.0.0`.

### PH12-T08: SEO, Sitemap & Route Privacy

- `apps/web/src/app/robots.ts` & `apps/web/public/robots.txt`: Disallows indexing of private student flows (`/dashboard`, `/plan`, `/practice`, `/reassessment`, `/notebook`, `/profile`, `/settings`, `/setup`, `/onboarding`, `/admin`) while allowing public landing, auth, privacy, and assessment preview pages.
- `apps/web/src/app/sitemap.ts`: Dynamic XML sitemap listing public indexable URLs.
- `apps/web/next.config.ts`: Enforces `X-Robots-Tag: noindex, nofollow` on all private paths.

### PH12-T09: Secure First Admin Creator & Production Smoke Test

- `tools/create-admin.ts`: Single-use CLI tool creating or promoting an administrator with Argon2id password hashing, `emailVerifiedAt=now()`, and audit log generation.
- `tools/prod-smoke.mjs` (`pnpm smoke`): Automated production smoke test suite verifying health, readiness, security headers, robots/sitemap, noindex tags, assessment rendering, and student auth through proxy. **15/15 tests passing**.

### PH12-T10: Pilot Readiness Review (Section 38)

- `docs/PILOT_READINESS.md`: Section 38 Acceptance Checklist completed with full traceability and verification evidence. System confirmed ready for pilot student cohort.

---

## Deliverables & Artifacts

- Multi-stage Dockerfiles: `apps/api/Dockerfile`, `apps/web/Dockerfile`
- Compose & Ingress: `infra/docker-compose.prod.yml`, `infra/Caddyfile`
- Release workflow: `.github/workflows/release.yml`
- Environment template: `.env.production.example`
- Backup & restore tools: `tools/db-backup.sh`, `tools/db-restore.sh`, `tools/rehearse-backup.sh`
- Admin creator & smoke test: `tools/create-admin.ts`, `tools/prod-smoke.mjs`
- SEO & Sitemap: `apps/web/src/app/robots.ts`, `apps/web/src/app/sitemap.ts`, `apps/web/public/robots.txt`
- Runbook & docs: `docs/RUNBOOK.md`, `docs/MONITORING.md`, `docs/RELEASE_NOTES.md`, `docs/PILOT_READINESS.md`
