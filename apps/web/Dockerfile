# syntax=docker/dockerfile:1.4
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@12.15.0 --activate
WORKDIR /app

# ---- Dependencies Stage ----
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/ packages/
COPY tools/ tools/
COPY prisma/ prisma/
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json

RUN pnpm install --frozen-lockfile

# ---- Build Stage ----
FROM deps AS builder
COPY . .
ENV NODE_ENV=production
RUN pnpm db:generate
RUN pnpm --filter @aptiva/engine build
RUN pnpm --filter @aptiva/shared build
RUN pnpm --filter @aptiva/ingest build
RUN pnpm --filter @aptiva/web build

# ---- Production Runner Stage ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/tools ./tools
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/apps/web ./apps/web

USER nextjs
EXPOSE 3000

WORKDIR /app/apps/web
CMD ["node_modules/.bin/next", "start"]

