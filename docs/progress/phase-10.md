# PH-10 — Privacy, security and reliability hardening

Status: **complete** (2026-11-12) — pending external counsel review & ZAP scan (documented gaps)

## Delivered

- **E-070 `GET /me/data-export`** — re-auth (password via `x-reauth-password` header or body; Google-only accounts rely on fresh-token proof), returns full JSON export of all user-owned data, audited (`privacy.data_exported`).
- **E-071 `DELETE /me`** — re-auth → `deletion_requested_at` set, all refresh tokens revoked immediately, audit `account.deletion_requested`; `PrivacyJobService` (BullMQ `aptiva-privacy`, daily `upsertJobScheduler`) hard-deletes users 30 days later (`account.deleted` audit with id only, no personal content).
- **E-072 `PUT /me/consents`** — append-only `consent_records` for optional purposes (`analytics`, `marketing`, `support`); unknown purposes 409.
- **P-19 `/settings`** — plan settings (keepMyPlan), consent toggles, password-gated export (downloads JSON) and typed-DELETE account deletion.
- **PH10-T02 headers** — API Helmet CSP (`object-src 'none'`, `frame-ancestors 'none'`), Next.js `headers()` on all routes (XFO DENY, nosniff, Referrer-Policy, Permissions-Policy, CSP).
- **PH10-T03 authz** — T-020 integration test: cross-user session/comparison 404, student→admin 403, unauthenticated 401.
- **PH10-T06 admin audit** — global `AdminAuditInterceptor` records `admin.access` (actor, method, route — never bodies).
- **PH10-T07 deps** — `pnpm audit --prod` clean (tar 7.5.13→7.5.21 in tools/ingest).
- **PH10-T08 docs** — `docs/PRIVACY.md` draft notice + `docs/SECURITY.md` control/gap list.
- **PH10-T09 retention** — daily sweep: expired/used auth tokens, revoked refresh tokens >90d, audit log >400d.

## Tests

- T-019 export/delete/consents — pass. T-020 authz matrix — pass.
- Full integration **67/67**, engine **37/37**, lint/typecheck/build clean.

## Known gaps (carried to pilot checklist)

- ZAP baseline scan not yet executed (needs deployed stack).
- Password-reset email delivery unverified (`EMAIL_API_KEY`).
- Upload pipeline deferred — no upload surface exists yet.
- Rate limiting is in-process; needs Redis backing for multi-instance.
- Counsel review of `docs/PRIVACY.md` outstanding — **pilot waits for it** per playbook.
