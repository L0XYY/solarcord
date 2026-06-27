# SolarCord — Roadmap & Feature Checklist

Phases are shippable slices. Each builds on the last; every phase ends in a runnable, testable app. `[x]` = done, `[~]` = in progress, `[ ]` = planned.

---

## Phase 1 — Auth, servers, channels, text messaging  ← **current**
- [~] Monorepo + tooling (pnpm workspaces, TS, Prisma, docker compose)
- [~] Database schema (full core model set)
- [~] Email/password signup + login (Argon2, JWT access + refresh)
- [ ] Session refresh + logout, auth middleware on every route
- [~] Server create / list / get
- [~] Channel create / list (text channels)
- [~] Real-time messaging over Socket.IO (send, receive, history)
- [ ] Typing indicators, presence (online/idle/dnd/invisible)
- [~] Web: login/signup, app shell (server dock, channel sidebar, chat panel, member list)

## Phase 2 — DMs, friends, roles, permissions, invites
- [x] Friend requests (send/accept/decline/cancel/remove), friends page with tabs
- [x] 1:1 DMs + group DM data model, real-time direct messaging (send/edit/delete/reply)
- [ ] Group DM management UI (add/remove/leave), DM reactions, blocking
- [x] Roles management UI — create/edit/delete roles, colours, permission toggles, per-member assignment, hierarchy + no-elevation safety
- [x] Invite links (create, join, expiry, max uses) — REST + `/invite/[code]` page
- [x] Message edit/delete/reply/reactions (REST + realtime + UI)
- [ ] Mentions, markdown rendering, code blocks
- [ ] Pinned messages, slowmode

**Phase 2 core complete.** Remaining items above are polish carried into later phases.

## Phase 3 — Moderation, badges, discovery, onboarding
- [x] Kick / ban / unban / timeout (mute) with hierarchy safety + audit log writes
- [x] Audit log viewer + Bans list (server settings)
- [x] Server badges display (Verified, Solar Partner, Community, Discoverable, Boosted…) derived from server flags, with tooltips
- [x] Discovery page (search, categories, server cards with badges, direct join)
- [x] Server visibility + category settings (Overview tab) → makes servers discoverable
- [x] Badge application + staff review flow (apply in settings → approve/reject in admin panel)
- [x] AutoMod keyword filter (per-server blocked words, enforced on send)
- [ ] AutoMod spam/invite/phishing detection, raid protection
- [x] Warn system + private moderator notes on members (settings → Members → ⚠)
- [x] Server rules + welcome/guide screen (settings → Welcome & rules; 📖 Welcome for members)
- [ ] Onboarding questions → role/channel assignment, rules screening gate

## Phase 4 — Voice, video, screen share
- [ ] LiveKit integration (SFU), voice channels, mute/deafen, PTT, VAD
- [ ] Video calls, screen/app/window share, "Go Live" streaming
- [ ] Stage channels (speakers/audience), event voice rooms
- [ ] Per-user volume, noise suppression toggle

## Phase 5 — Bots, apps, webhooks, developer portal
- [x] Incoming webhooks — create per channel (MANAGE_WEBHOOKS), public execute URL, posts render with custom name + "APP" tag
- [x] Developer portal at `/developer` — create bot apps, tokens (`Authorization: Bot <token>`), reset, add bot to a server; bots post via the REST API
- [ ] OAuth2 authorize flow, slash commands, context-menu commands, app directory
- [ ] Outgoing webhooks, generated REST API docs

## Phase 6 — Premium Solar+, boosts, payments
- [ ] Stripe billing, Solar+ subscription, premium profile features
- [ ] Server boosts, boost levels/perks, vanity URLs, subscriber/evolving badges

## Phase 7 — Admin panel, reports, safety, polish
- [x] Platform admin dashboard at `/admin` (staff-gated): overview stats, user suspend/unsuspend, server verify/partner/remove, badge-application review
- [x] Report system — report messages/users/servers; staff Reports queue with action-taken/dismiss
- [ ] Mod queue (per-server), safety alerts, feature flags, site announcements
- [ ] Payments/analytics/audit-trail views

## Phase 8 — Mobile responsiveness & production deployment
- [x] Responsive app shell — single-pane mobile navigation with back buttons, full-width sidebars under `md`, member list hidden on small screens
- [x] Production deployment guide (`docs/DEPLOYMENT.md`)
- [ ] Settings/admin modals fully optimised for small screens (currently best on tablet+)
- [ ] Desktop app shell (Electron/Tauri), push notifications
- [ ] CI/CD pipeline, observability

---

## Full feature inventory (reference)

Tracked against the original spec. Lives here so we never lose sight of scope.

**Accounts:** email+password, OAuth, profile (username/display/avatar/banner/bio/pronouns/badges), statuses (online/idle/dnd/invisible), rich presence, friend requests, blocking, settings, privacy, 2FA, account delete/export.

**Servers:** create, invites, icon/banner/splash/description, categories, roles/permissions, owner transfer, settings dashboard, templates, rules page, guide/welcome, onboarding, analytics, discovery, public/private, community, partnered, verified, official badge, boost levels.

**Channels:** text, voice, video, announcement, stage/event, forum, media, rules, private role-only, threads, polls, pinned, slowmode, NSFW/age-gate, per-channel permissions.

**Messaging:** realtime WS, edit/delete/reply, reactions, emoji picker, custom emojis, stickers, GIF search, file uploads, image/video previews, link embeds, code blocks, markdown, mentions (@user/@role/@everyone/@here), search w/ filters, jump links, read state, typing, drafts, scheduled.

**DMs:** 1:1, group, group icons/names, voice/video calls, screen share, add/remove/leave, privacy, message requests.

**Voice/video:** voice channels, video, screen share, Go Live, PTT, VAD, mute/deafen, volume slider, noise suppression, camera toggle, share scope, stage channels, event rooms, optional E2E design, WebRTC/LiveKit.

**Roles/perms:** hierarchy, colours, icons, presets, channel overrides, admin, manage server/channels/roles, kick/ban/timeout, manage messages/webhooks, mention everyone, audit log, manage emoji/events, view private channels, thread perms, voice perms, stage mod.

**Moderation:** kick/ban/unban/timeout, warns, notes, audit logs, AutoMod, spam/invite/phishing detection, raid protection, pause invites/DMs, verification levels, rules screening, reporting, mod dashboard/queue, safety alerts, CAPTCHA.

**Bots/apps:** dev portal, bot tokens, OAuth2, slash + context commands, webhooks, permissions, app directory, install flow, bot roles, rate limits, API docs, gateway events, REST, SDK.

**Premium (Solar+):** animated avatars, banners, themes, name effects, upload limits, HD streaming, more emoji/stickers, custom app icons, video backgrounds, per-server profiles, premium/evolving badges, boosts + discounts.

**Server boosts:** levels, emoji slots, audio quality, upload limit, animated icon/banner, vanity URL, customisation, profile badge, streaks.

**User badges:** Staff, Early Supporter, Solar+ Subscriber, Solar Partner, Verified Bot Developer, Bug Hunter, Server Booster, Active Developer, Moderator Alumni, Hype/Launch, custom event badges.

**Notifications:** push, desktop, mobile, unread badges, mentions tab, per-server/channel settings, mute, suppress @everyone/@here, keyword, email security alerts.

**Admin panel:** users, servers, suspend/remove, verify, partner approval, badge applications, reports, premium plans, payments, analytics, audit trails, feature flags, announcements, safety tools.
