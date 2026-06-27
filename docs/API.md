# SolarCord — API & Realtime Reference

Base URL (dev): `http://localhost:4000`. All bodies are JSON. Auth via `Authorization: Bearer <accessToken>` unless marked **public**.

## REST — Phase 1

### Auth
| Method | Path | Auth | Body | Returns |
|--------|------|------|------|---------|
| POST | `/auth/signup` | public | `{ email, username, displayName?, password }` | `{ user, accessToken }` + refresh cookie |
| POST | `/auth/login` | public | `{ email, password }` | `{ user, accessToken }` + refresh cookie |
| POST | `/auth/refresh` | cookie | — | `{ accessToken }` (rotates refresh cookie) |
| POST | `/auth/logout` | yes | — | `204` (revokes refresh) |
| GET  | `/auth/me` | yes | — | `{ user }` |

### Servers
| Method | Path | Permission | Notes |
|--------|------|-----------|-------|
| GET | `/servers` | member | servers the current user belongs to |
| POST | `/servers` | authed | create; creator becomes owner, gets @everyone role + default channels |
| GET | `/servers/:id` | member | server detail + channels + roles |
| PATCH | `/servers/:id` | MANAGE_SERVER | name/icon/description |
| DELETE | `/servers/:id` | owner | delete server |
| GET | `/servers/:id/members` | member | member list |

### Channels
| Method | Path | Permission | Notes |
|--------|------|-----------|-------|
| POST | `/servers/:id/channels` | MANAGE_CHANNELS | create text channel (more types later) |
| PATCH | `/channels/:id` | MANAGE_CHANNELS | rename, topic, slowmode |
| DELETE | `/channels/:id` | MANAGE_CHANNELS | delete |

### Messages
| Method | Path | Permission | Notes |
|--------|------|-----------|-------|
| GET | `/channels/:id/messages?before=&limit=` | VIEW_CHANNEL + READ_HISTORY | paginated history (newest first) |
| POST | `/channels/:id/messages` | SEND_MESSAGES | create; broadcasts `message:create` |

## REST — Phase 2

### Messages (additions)
| Method | Path | Permission |
|--------|------|-----------|
| PATCH | `/channels/:id/messages/:messageId` | author only |
| DELETE | `/channels/:id/messages/:messageId` | author or MANAGE_MESSAGES |
| PUT | `/channels/:id/messages/:messageId/reactions/:emoji` | ADD_REACTIONS |
| DELETE | `/channels/:id/messages/:messageId/reactions/:emoji` | own reaction |

### Invites
| Method | Path | Permission |
|--------|------|-----------|
| POST | `/servers/:id/invites` | CREATE_INVITE |
| GET | `/servers/:id/invites` | member |
| GET | `/invites/:code` | authed (preview) |
| POST | `/invites/:code/join` | authed |

### Friends
| Method | Path | Notes |
|--------|------|-------|
| GET | `/friends` | `{ friends, incoming, outgoing }` |
| POST | `/friends/requests` | `{ username }`; auto-accepts a reverse request |
| POST | `/friends/requests/:id/accept` | addressee only |
| DELETE | `/friends/requests/:id` | decline (addressee) or cancel (requester) |
| DELETE | `/friends/:userId` | remove an accepted friend |

### DMs
| Method | Path | Notes |
|--------|------|-------|
| GET | `/dms` | conversations + last message |
| POST | `/dms` | `{ userIds[], name? }`; 1 → reuse 1:1, 2+ → group |
| GET | `/dms/:id/messages` | participant only |
| POST | `/dms/:id/messages` | broadcasts `message:create` to `dm:{id}` |
| PATCH/DELETE | `/dms/:id/messages/:messageId` | author only |

### Roles & permissions
| Method | Path | Permission / rule |
|--------|------|-------------------|
| GET | `/servers/:id/roles` | member |
| POST | `/servers/:id/roles` | MANAGE_ROLES; can't grant bits you lack |
| PATCH | `/roles/:id` | MANAGE_ROLES; role below your highest; no self-elevation; can't rename @everyone |
| DELETE | `/roles/:id` | MANAGE_ROLES; role below your highest; not @everyone |
| PUT | `/servers/:id/members/:userId/roles/:roleId` | MANAGE_ROLES; role below your highest |
| DELETE | `/servers/:id/members/:userId/roles/:roleId` | MANAGE_ROLES; role below your highest |

`GET /servers/:id/members` now also returns each member's `roleIds`.

### New realtime events
- Server→client: `reaction:add`, `reaction:remove`, `friend:request`, `friend:update`, `conversation:new`
- Client→server: `conversation:focus`, `conversation:blur`, `conversation:typing`
- DM messages reuse `message:create/update/delete`; the `channelId` field carries the conversation id.

## REST — Phase 3

### Moderation
| Method | Path | Permission / rule |
|--------|------|-------------------|
| DELETE | `/servers/:id/members/:userId` | KICK_MEMBERS; must outrank target; not owner |
| GET | `/servers/:id/bans` | BAN_MEMBERS |
| POST | `/servers/:id/bans` | BAN_MEMBERS; `{ userId, reason?, deleteMessageDays? }` |
| DELETE | `/servers/:id/bans/:userId` | BAN_MEMBERS |
| POST | `/servers/:id/members/:userId/timeout` | TIMEOUT_MEMBERS; `{ minutes }` (0 clears) |
| GET | `/servers/:id/audit-logs` | VIEW_AUDIT_LOG |

Timed-out members are blocked from sending messages; banned users can't (re)join via invite or discovery. `GET /servers/:id` now returns `me: { isOwner, permissions }` for UI gating.

### Discovery
| Method | Path | Notes |
|--------|------|-------|
| GET | `/discovery?q=&category=` | public/community/discoverable servers + derived badges |
| GET | `/discovery/:id` | preview + `isMember` |
| POST | `/discovery/:id/join` | join a non-private server directly (ban-checked) |

Server badges are derived from server flags (verified/partnered/visibility/boost) — see `SERVER_BADGE_INFO` in `@solarcord/shared`.

## Realtime — Socket.IO gateway

Connect: `io(API_URL, { auth: { token: accessToken } })`.

### Client → server
| Event | Payload | Effect |
|-------|---------|--------|
| `channel:focus` | `{ channelId }` | join `channel:{id}` room (after permission check) |
| `channel:blur` | `{ channelId }` | leave the room |
| `typing:start` | `{ channelId }` | broadcast typing to channel (3s TTL) |
| `presence:update` | `{ status }` | set online/idle/dnd/invisible |

### Server → client
| Event | Payload | When |
|-------|---------|------|
| `ready` | `{ user, servers }` | after socket auth |
| `message:create` | `Message` | someone sent a message in a focused channel |
| `message:update` | `Message` | edited (Phase 2) |
| `message:delete` | `{ id, channelId }` | deleted (Phase 2) |
| `typing:start` | `{ channelId, userId }` | another user is typing |
| `presence:update` | `{ userId, status }` | a relevant user's presence changed |
| `error` | `{ code, message }` | gateway-level error |

All realtime mutations are authorized server-side before broadcast. Clients render optimistically but reconcile to server state.

## Error shape
```json
{ "error": { "code": "FORBIDDEN", "message": "Missing permission: MANAGE_CHANNELS" } }
```
Codes: `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION`, `RATE_LIMITED`, `CONFLICT`, `INTERNAL`.
