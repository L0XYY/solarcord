# SolarCord — Production Deployment

This guide covers shipping SolarCord to production. The app is two deployables — the **API** (`apps/api`) and the **web** client (`apps/web`) — plus **Postgres** and **Redis**.

## 1. Provision infrastructure

| Need | Managed option (easy) | Self-host |
|------|----------------------|-----------|
| Postgres | [Neon](https://neon.tech), Supabase, RDS | `docker compose` Postgres |
| Redis | [Upstash](https://upstash.com), Redis Cloud | `docker compose` Redis |
| API host | Render, Railway, Fly.io, a VPS | Docker on your server |
| Web host | Vercel, Netlify, Cloudflare Pages | Node server / Docker |
| Object storage (uploads, later) | Cloudflare R2, S3 | MinIO |

## 2. Environment variables (production)

Set these on the **API** host (never commit real secrets):

```bash
NODE_ENV=production
DATABASE_URL=postgresql://USER:PASS@HOST:5432/solarcord?sslmode=require
REDIS_URL=rediss://default:PASS@HOST:6379
JWT_ACCESS_SECRET=<64+ random hex>   # node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
JWT_REFRESH_SECRET=<different 64+ random hex>
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL_DAYS=30
API_PORT=4000
WEB_ORIGIN=https://your-web-domain.com   # exact origin, for CORS + cookies
```

On the **web** host:

```bash
NEXT_PUBLIC_API_URL=https://your-api-domain.com
```

> **Cookies/CORS:** the refresh cookie is `httpOnly; Secure; SameSite=Lax` and scoped to `/auth`. In production, serve both over HTTPS. If API and web are on different domains, the browser still sends the cookie on the `/auth/refresh` call because requests use `credentials: "include"` and CORS is configured with `credentials: true` + the exact `WEB_ORIGIN`.

## 3. Build & migrate

```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm --filter @solarcord/db exec prisma migrate deploy   # apply migrations (no dev prompts)
pnpm --filter @solarcord/api build                        # → apps/api/dist
pnpm --filter @solarcord/web build                        # → apps/web/.next
```

Run:

```bash
# API
node apps/api/dist/index.js
# Web
pnpm --filter @solarcord/web start    # next start -p 3000
```

## 4. First-run migration note

You haven't created an initial migration yet (dev has been using `prisma generate` + a fresh schema). On first deploy, generate the baseline migration once from a machine with DB access:

```bash
pnpm --filter @solarcord/db exec prisma migrate dev --name init    # creates prisma/migrations/*
git add packages/db/prisma/migrations && git commit -m "db: initial migration"
```

Thereafter use `prisma migrate deploy` in CI/CD.

## 5. Scaling notes

- The API is **stateless** — run N replicas behind a load balancer. The Socket.IO **Redis adapter** keeps realtime coherent across replicas (already wired in `apps/api/src/realtime.ts`).
- Make sure the load balancer allows **WebSocket upgrades** and sticky sessions aren't required (the Redis adapter handles cross-node fan-out).
- Put Postgres behind PgBouncer if you scale API replicas high; Prisma's pool is per-process.

## 6. Containerising (optional)

`docker-compose.yml` already runs Postgres + Redis for local dev. For the app itself, a minimal API Dockerfile:

```dockerfile
FROM node:20-alpine
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile && pnpm db:generate && pnpm --filter @solarcord/api build
EXPOSE 4000
CMD ["node", "apps/api/dist/index.js"]
```

## 7. Features that need external accounts

Two phases are **integration-ready in code** but require third-party credentials to actually run:

- **Voice / video (Phase 4)** — needs a [LiveKit](https://livekit.io) project (`LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`). The SFU does the media; SolarCord issues join tokens.
- **Solar+ premium & boosts (Phase 6)** — needs [Stripe](https://stripe.com) keys (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) for checkout + subscription webhooks.

Until those are configured, the rest of the platform runs fully.

## 8. Pre-launch checklist

- [ ] Strong, unique `JWT_*` secrets set (not the dev defaults)
- [ ] HTTPS on both API and web; `WEB_ORIGIN` / `NEXT_PUBLIC_API_URL` are exact prod URLs
- [ ] `prisma migrate deploy` run against prod DB
- [ ] Redis reachable from all API replicas
- [ ] Rate limits reviewed (`@fastify/rate-limit`, currently 300/min/IP)
- [ ] A staff account created (`isStaff = true`) for the `/admin` console
- [ ] Backups configured on Postgres
