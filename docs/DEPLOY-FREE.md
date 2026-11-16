# Free-Tier Deployment Guide (no credit card required)

Deploys Aptiva across four free services:

| Piece                   | Service | URL you get                          |
| ----------------------- | ------- | ------------------------------------ |
| Frontend (Next.js)      | Vercel  | `https://<app>.vercel.app`           |
| API (NestJS)            | Render  | `https://aptiva-api.onrender.com`    |
| Worker (streams/BullMQ) | Render  | `https://aptiva-worker.onrender.com` |
| PostgreSQL              | Neon    | `postgresql://...neon.tech/...`      |
| Redis                   | Upstash | `rediss://...upstash.io:6379`        |

All signups work with GitHub or Google login — **no card anywhere**.

> **Cold-start warning:** Render free services sleep after ~15 min idle.
> The first request after idle takes 30–60 s. Open the app a few minutes
> before any demo.

---

## Step 1 — Neon (PostgreSQL)

1. Go to https://neon.tech → Sign up with GitHub/Google.
2. **Create project** → name `aptiva`, region closest to you (e.g. `ap-south-1` Mumbai if available, else `us-east-1`).
3. Copy the **connection string** (Dashboard → Connection Details). Choose the **direct** (non-pooled) connection — the API is a long-running process, pooling isn't needed.
4. Keep it handy as `DATABASE_URL`.

## Step 2 — Upstash (Redis)

1. Go to https://upstash.com → Sign up with GitHub/Google.
2. **Create Database** → type **Redis** → region closest to Render (e.g. `us-east-1`), pay-as-you-go free tier (200k commands/day — plenty).
3. Copy the **REST URL / Redis URL** — you want the `rediss://default:...@....upstash.io:6379` form as `REDIS_URL`.

## Step 3 — Render (API + worker)

1. Go to https://render.com → Sign up with GitHub.
2. **New → Blueprint** → connect the `EshwariWasankar/Aptiva-Fresh` repo → Render reads `render.yaml` at the repo root and creates both services.
   - If Blueprint isn't offered, use **New → Web Service** twice manually (see env vars below).
3. After services are created, fill the `sync: false` env vars on **both** services:

   | Var                                                      | Value                                                                                                                  |
   | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
   | `DATABASE_URL`                                           | Neon connection string (Step 1)                                                                                        |
   | `REDIS_URL`                                              | Upstash Redis URL (Step 2)                                                                                             |
   | `CORS_ORIGINS` (api only)                                | `https://<your-app>.vercel.app`                                                                                        |
   | `WEB_BASE_URL` (api only)                                | `https://<your-app>.vercel.app`                                                                                        |
   | `EMAIL_API_KEY` / `EMAIL_FROM`                           | optional — or leave unset; console-mail is disabled in prod, so auth emails won't send until you configure SMTP/Resend |
   | `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` (worker only) | copy the values Render auto-generated on the **api** service                                                           |

   Leave `COOKIE_DOMAIN` unset (default `localhost` → host-only cookie, correct behind the Vercel proxy).

4. Wait for both deploys to go **Live**. The worker shows no useful health check — verify it's running in its logs (`attempt consumer` startup lines).

## Step 4 — Vercel (frontend)

1. Go to https://vercel.com → Sign up with GitHub → **Add New → Project** → import `Aptiva-Fresh`.
2. **Root Directory:** set to `apps/web` (Project Settings → General, or during import "Edit").
3. **Environment variable (Production):**
   - `API_INTERNAL_URL` = `https://aptiva-api.onrender.com` ← set BEFORE first build; `next.config.ts` rewrites `/api/*` to it at build time.
   - Optionally `NEXT_PUBLIC_APP_URL` = your future `https://<app>.vercel.app`.
4. Deploy. You get `https://<something>.vercel.app`.

## Step 5 — Database setup (run once)

From your local machine (Docker + repo already set up):

```bash
# Point prisma at the Neon DB temporarily
cd "D:\aptiva main"
# Edit prisma/.env or export DATABASE_URL=<neon-url> then:
pnpm db:migrate:deploy
pnpm db:seed            # taxonomy, blueprints, seed questions
pnpm db:seed-diagnostic # diagnostic pool (if separate)
pnpm db:seed-mcq-topics # if applicable
```

Then create the admin user:

```bash
DATABASE_URL=<neon-url> pnpm create-admin   # tools/create-admin.ts
```

Insert the DS-03 topic synonym (required or GSM8K import rejects everything):

```sql
INSERT INTO topic_synonyms (phrase, topic_id)
SELECT 'arithmetic', id FROM topics WHERE slug='number-system'
ON CONFLICT (phrase) DO NOTHING;
INSERT INTO topic_synonyms (phrase, topic_id)
SELECT 'grade-school arithmetic', id FROM topics WHERE slug='number-system'
ON CONFLICT (phrase) DO NOTHING;
```

Run it via Neon console (SQL Editor) or `psql`.

## Step 6 — Content import (numerical questions)

Log in as admin → **Admin → Import → ds-03**:

- **Dry run** first: expect `accepted: 7473`.
- If HF rate-limits (429), download the GSM8K parquet locally, convert to JSONL (`{"question","answer"}` per line), and… note: `GSM8K_JSONL_PATH` is an API-side env var — set it on the Render API service pointing to a file inside the container isn't practical. Instead, **re-run the import a few times** — HF rate limits reset, and the retry/backoff handles most cases. Worst case, temporarily host the JSONL and patch the URL.
- After import lands 7,473 drafts → publish them (they're practice-pool, no review needed). This currently requires either per-question publish via Admin UI or a SQL update:

```sql
UPDATE questions SET status='published'
WHERE import_batch_id='<batch-id>' AND status='draft'
  AND pool='practice' AND format='numerical'
  AND source_name IS NOT NULL AND numeric_answer IS NOT NULL;
```

## Step 7 — Smoke test

```bash
node tools/prod-smoke.mjs https://<your-app>.vercel.app
```

Then manually: register → diagnostic → requirements → plan → practice (verify numerical questions appear ~15-25% in quant topics) → profile → settings.

---

## Troubleshooting

| Symptom                                  | Fix                                                                                                                                                          |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Vercel build fails on `API_INTERNAL_URL` | env var must exist at build time — set it, then **Redeploy**                                                                                                 |
| API 502 / CORS errors                    | `CORS_ORIGINS` must list the exact Vercel domain (no trailing slash)                                                                                         |
| Login loops / not logged in              | cookie issue — keep `COOKIE_DOMAIN` unset; ensure you're on the `*.vercel.app` domain, not a custom alias mismatch                                           |
| Import ds-03 → "rate limited"            | retry later, or run the import from local dev against the prod DB (`DATABASE_URL=<neon> pnpm dev` in apps/api) — the `GSM8K_JSONL_PATH` override works there |
| Worker idle, no recalc                   | free worker sleeps too — it's fine, it wakes on activity; check Render logs for consumer startup                                                             |
| Everything slow on first load            | cold start — wait ~60 s, refresh                                                                                                                             |

## Teardown / costs

Everything is free-tier; just remember to **pause/delete** Neon + Upstash + Render services after the review if you don't want them lingering (Render free services don't bill anyway, but tidy is tidy).
