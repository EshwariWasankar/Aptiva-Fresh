# Security posture — Aptiva (PH-10)

Status: internal baseline for pilot review. **Not a legal compliance claim** —
counsel review is still required before real student data (playbook PH-10 gate).

## Implemented controls

| Area               | Control                                                                                                                                                                             | Where                                                                |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| AuthN              | Argon2id password hashing, HIBP breached-password check, generic login errors (no user enumeration), JWT access (15 min) + rotating refresh tokens with family revocation on replay | `apps/api/src/auth`                                                  |
| Sessions           | httpOnly refresh cookie, `x-aptiva-client` header on cookie mutations, refresh-on-401 exactly once                                                                                  | `apps/web/src/lib/apiClient.ts`                                      |
| Authorization      | Global `AuthGuard` → `RolesGuard` → owner checks on every `/me`, `/sessions`, `/diagnostic` route; admin routes role-gated; T-020 matrix test covers cross-user 404s                | `apps/api/src/common/guards`, `test/integration/privacy.int.test.ts` |
| Answer-key secrecy | Keys live only in server-side Redis cache; submit response carries no key material; reveal endpoint resolves only after the attempt row exists                                      | `attempts.service.ts`                                                |
| Rate limiting      | Per-route buckets + `RATE_LIMIT_FACTOR` for tests                                                                                                                                   | `rate-limit.guard.ts`                                                |
| Headers            | Helmet CSP (API), Next.js `headers()` — X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, CSP                                                                     | `main.ts`, `next.config.ts`                                          |
| Audit              | `audit_log` for auth events, admin access (every `/admin/*` call via interceptor), privacy actions; retention sweep purges >400 days                                                | `common/audit`                                                       |
| Privacy            | Data export + account deletion (30-day delay, re-auth, token revocation, cascade delete job), consent withdrawal records                                                            | `privacy/` module                                                    |
| Degraded mode      | Attempt stream → direct DB fallback; recalc failure never blocks practice; neutral retry                                                                                            | PH-4/PH-8                                                            |
| Dependencies       | `pnpm audit --prod` clean (tar bumped to 7.5.21 in tools/ingest)                                                                                                                    | —                                                                    |

## Known gaps / for counsel & later phases

- **ZAP baseline scan not yet run** — needs a running stack + OWASP ZAP; scheduled as manual step before pilot.
- **No MFA / password reset email delivery** — reset flow exists but depends on `EMAIL_API_KEY`; verify deliverability.
- **Upload pipeline** — deferred (E-022 optional); if enabled later, the quarantine/scan chain in Section 23 applies.
- **Consent text** — draft in `docs/PRIVACY.md`; requires counsel review.
- Rate-limit buckets are in-process; multi-instance deployment needs Redis-backed limiting (PH-12).
- Error messages are generic by design; ensure no stack traces leak in production (`NODE_ENV=production`).

## Verification evidence

- T-019: export re-auth (401 without/with wrong password), delete scheduling + token revocation, consent withdrawal, unknown-purpose rejection.
- T-020: cross-user session/comparison 404s, student→admin 403, unauthenticated 401, admin audit row written.
- SEC-011: server-side timestamps only; client clocks stripped.
