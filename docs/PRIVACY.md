# Privacy notice — DRAFT for counsel review (PH-10-T08)

> This is an engineering draft, not legal advice. Have counsel review before
> pilot. Consent version string: `2026-11`.

## What we collect

- **Account**: email, password hash (Argon2id — we never store plaintext), role.
- **Learning data**: diagnostic and practice answers, timestamps, time spent,
  topic-level skill estimates, study plans, mistake notes you add.
- **Technical**: request IDs, audit events (who did what, when — no content),
  rate-limit counters.

## What we do NOT do

- Sell or share personal data with third parties.
- Use your answers to train models on identifiable records.
- Store payment details (billing is deferred).

## Your controls (implemented)

- **Export**: Settings → "Download my data" — full JSON export of everything we hold (re-auth required).
- **Delete**: Settings → "Delete account" — schedules permanent deletion after 30 days; all sessions/tokens revoked immediately.
- **Consents**: optional purposes (analytics, marketing, support) can be withdrawn at any time in Settings; each change is recorded.

## Retention

- Account data: until you delete (then ≤30 days to execute).
- Audit logs: 400 days, then purged.
- Auth tokens: expired/used tokens purged daily; revoked refresh tokens after 90 days.
- Backups rotate on the hosting provider's schedule.

## Security

See `docs/SECURITY.md` for the implemented control set and known gaps.

## Contact / grievances

[To be filled by counsel — data-controller contact and grievance process.]
