# SolarCord

A modern, original real-time community chat platform — servers, channels, DMs, voice/video, roles, moderation, bots, discovery, and a premium tier (**Solar+**). Discord-inspired in *features only*; SolarCord has its own identity, layout, design system, and naming.

> **Status:** Phase 1 in progress — auth, servers, channels, and real-time text messaging.
> See [`docs/ROADMAP.md`](docs/ROADMAP.md) for the full phase plan and feature checklist.

## Monorepo layout

```
solarcord/
├─ apps/
│  ├─ api/        Fastify + Socket.IO backend (REST + realtime gateway)
│  └─ web/        Next.js App Router frontend (the SolarCord client)
├─ packages/
│  ├─ db/         Prisma schema + generated client (single source of DB truth)
│  └─ shared/     Zod schemas, shared types, permission bitfield, WS event contracts
├─ docs/          Architecture, API, roadmap
└─ docker-compose.yml   Postgres + Redis for local dev
```

## Tech stack

| Layer      | Choice |
|------------|--------|
| Frontend   | Next.js (App Router), TypeScript, Tailwind, Framer Motion, Zustand, TanStack Query |
| Backend    | Node.js, Fastify, Socket.IO (realtime gateway), Zod validation |
| Database   | PostgreSQL + Prisma ORM |
| Cache/PubSub | Redis (presence, sessions, rate limits, fan-out across API nodes) |
| Auth       | Argon2 password hashing, JWT access + httpOnly refresh tokens |
| Storage    | S3/R2-compatible (uploads) — wired in Phase 1.5 |
| Voice/Video| LiveKit (SFU) — Phase 4 |
| Payments   | Stripe — Phase 6 |

## Quick start (Windows + VS Code)

See [Setup](#setup-windows--vs-code) below for the full walkthrough. TL;DR:

```bash
npm install -g pnpm           # one-time
pnpm install                  # install all workspaces
docker compose up -d          # start Postgres + Redis
cp .env.example .env          # then fill in secrets (a default dev .env works as-is)
pnpm db:migrate               # create the schema
pnpm db:seed                  # optional demo data
pnpm dev                      # run api (4000) + web (3000) together
```

Open http://localhost:3000.

## Setup (Windows + VS Code)

1. **Install Node 20+** — you have v24, good. Verify: `node -v`.
2. **Install pnpm:** `npm install -g pnpm`
3. **Install Docker Desktop** (for Postgres + Redis): https://www.docker.com/products/docker-desktop/
   - No Docker? Use a free hosted Postgres (Neon/Supabase) and Redis (Upstash) and put their URLs in `.env`.
4. **Clone/open** this folder in VS Code. Recommended extensions: ESLint, Prisma, Tailwind CSS IntelliSense.
5. Run the Quick Start commands above.

## Useful scripts

| Command | What it does |
|---------|--------------|
| `pnpm dev` | Run API + web concurrently |
| `pnpm --filter @solarcord/api dev` | Run only the backend |
| `pnpm --filter @solarcord/web dev` | Run only the frontend |
| `pnpm db:migrate` | Apply Prisma migrations (dev) |
| `pnpm db:studio` | Open Prisma Studio (DB GUI) |
| `pnpm db:seed` | Seed demo users/servers |
| `pnpm lint` | Lint all packages |
| `pnpm build` | Production build of all apps |

## License / branding

SolarCord is an original product. It does **not** use Discord's name, logos, icons, colours, or UI assets. Discord is referenced only as feature inspiration.
