# SolarCord — System Architecture

## High-level

```
                          ┌─────────────────────────────┐
                          │        Web client           │
                          │  Next.js (App Router)        │
                          │  Zustand · TanStack Query    │
                          │  Socket.IO client            │
                          └───────┬───────────────┬──────┘
                            HTTPS │ REST          │ WSS (Socket.IO)
                                  ▼               ▼
                          ┌─────────────────────────────┐
                          │      API node (Fastify)      │
                          │  REST modules + WS gateway   │
                          │  Zod validation · Argon2/JWT │
                          └───┬──────────┬───────────┬───┘
                              │          │           │
                     Prisma  │          │ Redis     │ S3/R2 (Phase 1.5)
                              ▼          ▼ pub/sub   ▼  LiveKit (Phase 4)
                       ┌───────────┐  ┌─────────┐  ┌──────────┐
                       │ Postgres  │  │  Redis  │  │  Storage │
                       └───────────┘  └─────────┘  └──────────┘
```

**Why these pieces**
- **Fastify** over NestJS: lighter, faster cold start, schema-first with Zod. Modules give us Nest-like structure without the framework weight.
- **Socket.IO**: rooms map cleanly to channels/servers/DMs; built-in reconnection + ack. The **Redis adapter** lets multiple API nodes fan messages out to each other, so realtime scales horizontally.
- **Redis**: presence (who's online), typing TTLs, rate-limit counters, session/refresh-token denylist, and Socket.IO pub/sub.
- **Prisma**: one schema package (`@solarcord/db`) is the single source of DB truth, imported by the API.

## Request lifecycle (REST)
1. Client sends request with `Authorization: Bearer <accessToken>`.
2. `authPlugin` verifies JWT → attaches `request.user`.
3. Route handler validates body/params with a Zod schema from `@solarcord/shared`.
4. **Permission check**: for any server-scoped action, `requirePermission(serverId, PERM)` resolves the member's roles → computes the permission bitfield (base @everyone + roles + channel overrides) → throws 403 if missing. *Every server route runs this.*
5. Handler does the work via Prisma, writes an `AuditLog` row for sensitive actions.
6. For anything other clients should see live, the handler emits a gateway event (below).

## Realtime gateway (Socket.IO)
- On connect, client authenticates with its access token; the socket joins:
  - `user:{userId}` (personal events — DMs, friend requests, notifications)
  - `server:{serverId}` for each server it's a member of
  - `channel:{channelId}` when it focuses a channel
- The server is authoritative: clients **request** actions over REST (or socket events that revalidate permissions); the server **broadcasts** the resulting state. Clients never trust each other directly.
- Cross-node fan-out via `@socket.io/redis-adapter`.

See [`API.md`](API.md) for the event catalog.

## Permissions model
A 64-bit permission bitfield (stored as string/BigInt). Effective permissions for a member in a channel:

```
effective = @everyone base
          | (OR of all the member's role permission bits)        # role grants
then apply channel overrides in order:
          &= ~(deny bits)   then   |= (allow bits)   for @everyone override
          &= ~(role deny)   then   |= (role allow)   per applicable role
          &= ~(member deny) then   |= (member allow) for member-specific override
ADMINISTRATOR bit short-circuits → all permissions, except it cannot bypass server-owner-only actions.
```

Bit definitions live in `@solarcord/shared` (`Permission` enum) so client and server agree.

## Security rules (enforced, not aspirational)
- Passwords hashed with **Argon2id**; never logged, never returned.
- **Access token** (short-lived JWT, ~15 min) in memory on the client; **refresh token** (long-lived, rotating) in an **httpOnly, Secure, SameSite** cookie. Refresh rotation invalidates the old token (Redis denylist).
- Every REST route is auth-guarded unless explicitly public (signup, login, health).
- Every server-scoped route runs a permission check before mutating.
- All input validated with Zod; reject unknown fields.
- Output is allow-listed (DTO mappers) — we never spread raw Prisma rows containing secrets.
- Rate limiting per-IP and per-user (Redis token bucket) on auth + write routes.
- Uploads (Phase 1.5): type/size validated, stored off-origin (R2), served via signed URLs; scanned before publish.
- Audit log for moderation, role, and settings changes.
- Secrets only in `.env` / server env — never shipped to the client bundle.
- CSRF: refresh cookie is `SameSite=Lax` + a double-submit token on the refresh endpoint.

## Scaling path
- API is stateless → run N replicas behind a load balancer; Redis adapter keeps sockets coherent.
- Postgres read replicas for discovery/search later; heavy search → dedicated index (Phase 3+).
- Voice/video offloaded entirely to LiveKit SFU (Phase 4) — never proxied through the API.
