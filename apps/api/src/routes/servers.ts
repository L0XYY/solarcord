import type { FastifyInstance } from "fastify";
import { prisma } from "@solarcord/db";
import {
  createServerSchema,
  updateServerSchema,
  updateGuideSchema,
  DEFAULT_EVERYONE_PERMISSIONS,
  Permission,
  BANNER_BOOST_REQUIREMENT,
  boostLevelFor,
  room,
} from "@solarcord/shared";
import { Errors } from "../errors.js";
import { requireAuth, userId } from "../auth.js";
import { resolveMember, requirePermission } from "../permissions.js";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const SOLAR_PLUS_WEEKLY_BOOSTS = 2;

// Resolve a user's boost allowance. Staff get unlimited; Solar+ members get a
// weekly pool; everyone else gets none. Returns the (possibly reset) window too.
async function boostAllowance(uid: string) {
  const u = await prisma.user.findUnique({
    where: { id: uid },
    select: { isStaff: true, boostsUsed: true, boostWindowStart: true, badges: { where: { badge: { key: "solar_plus" } }, select: { id: true } } },
  });
  if (!u) throw Errors.notFound("User not found");
  const solarPlus = u.badges.length > 0;
  const now = new Date();
  let windowStart = u.boostWindowStart ?? null;
  let used = u.boostsUsed;
  // Roll the window forward if a week has elapsed.
  if (!windowStart || now.getTime() - windowStart.getTime() >= WEEK_MS) {
    windowStart = now;
    used = 0;
  }
  const max = u.isStaff ? Infinity : solarPlus ? SOLAR_PLUS_WEEKLY_BOOSTS : 0;
  const available = max === Infinity ? Infinity : Math.max(0, max - used);
  const resetAt = new Date(windowStart.getTime() + WEEK_MS);
  return { isStaff: u.isStaff, solarPlus, used, max, available, windowStart, resetAt };
}

export async function serverRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  // How many boosts the current user has available this week.
  app.get("/users/me/boosts", async (req) => {
    const a = await boostAllowance(userId(req));
    return {
      boosts: {
        isStaff: a.isStaff,
        solarPlus: a.solarPlus,
        used: a.used,
        max: a.max === Infinity ? null : a.max,
        available: a.available === Infinity ? null : a.available,
        resetAt: a.resetAt.toISOString(),
      },
    };
  });

  // List servers the current user belongs to.
  app.get("/servers", async (req) => {
    const memberships = await prisma.serverMember.findMany({
      where: { userId: userId(req) },
      include: { server: { select: { id: true, name: true, iconUrl: true, memberCount: true, tag: true, tagBadge: true } } },
      orderBy: { joinedAt: "asc" },
    });
    return { servers: memberships.map((m) => m.server) };
  });

  // Create a server: owner becomes member, @everyone role + default channels seeded.
  app.post("/servers", async (req, reply) => {
    const body = createServerSchema.parse(req.body);
    const uid = userId(req);

    const server = await prisma.server.create({
      data: {
        name: body.name,
        iconUrl: body.iconUrl,
        ownerId: uid,
        memberCount: 1,
        members: { create: { userId: uid } },
        roles: {
          create: {
            name: "@everyone",
            isEveryone: true,
            position: 0,
            permissions: DEFAULT_EVERYONE_PERMISSIONS.toString(),
          },
        },
        channels: {
          create: [
            { name: "general", type: "TEXT", position: 0 },
            { name: "Voice", type: "VOICE", position: 1 },
          ],
        },
      },
      include: { channels: true },
    });

    return reply.code(201).send({ server });
  });

  // Server detail (must be a member).
  app.get("/servers/:id", async (req) => {
    const { id } = req.params as { id: string };
    const ctx = await resolveMember(id, userId(req)); // throws if not a member

    const server = await prisma.server.findUnique({
      where: { id },
      include: {
        channels: { orderBy: { position: "asc" } },
        roles: { orderBy: { position: "desc" } },
      },
    });
    if (!server) throw Errors.notFound("Server not found");
    // `me` lets the client gate management UI; the server still enforces every action.
    return { server: { ...server, me: { isOwner: ctx.isOwner, permissions: ctx.basePermissions } } };
  });

  app.get("/servers/:id/members", async (req) => {
    const { id } = req.params as { id: string };
    await resolveMember(id, userId(req));
    const rows = await prisma.serverMember.findMany({
      where: { serverId: id },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true, status: true, tag: true, tagBadge: true } },
        roles: { select: { roleId: true } },
      },
      orderBy: { joinedAt: "asc" },
    });
    const members = rows.map((m) => ({
      id: m.id,
      nickname: m.nickname,
      joinedAt: m.joinedAt,
      user: m.user,
      roleIds: m.roles.map((r) => r.roleId),
    }));
    return { members };
  });

  app.patch("/servers/:id", async (req) => {
    const { id } = req.params as { id: string };
    await requirePermission(id, userId(req), Permission.MANAGE_SERVER);
    const body = updateServerSchema.parse(req.body);

    // A server banner is a boost-level-2 perk (7 boosts), like Discord.
    if (body.bannerUrl) {
      const current = await prisma.server.findUnique({ where: { id }, select: { boostCount: true } });
      if ((current?.boostCount ?? 0) < BANNER_BOOST_REQUIREMENT) {
        throw Errors.forbidden(`A server banner unlocks at ${BANNER_BOOST_REQUIREMENT} boosts`);
      }
    }

    const server = await prisma.server.update({ where: { id }, data: body });
    return { server };
  });

  // Boost the server. Staff are unlimited; Solar+ members spend from their weekly
  // pool of 2; everyone else can't boost (this is what stops infinite spam).
  app.post("/servers/:id/boost", async (req) => {
    const { id } = req.params as { id: string };
    const uid = userId(req);
    await resolveMember(id, uid);

    const a = await boostAllowance(uid);
    if (!a.isStaff) {
      if (!a.solarPlus) throw Errors.forbidden("Boosting is a Solar+ perk. Subscribe to Solar+ to get 2 boosts every week.");
      if (a.available <= 0) {
        const days = Math.max(1, Math.ceil((a.resetAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
        throw Errors.forbidden(`You've used both of your weekly Solar+ boosts. They refresh in ${days} day${days === 1 ? "" : "s"}.`);
      }
      // Spend a boost from the (possibly rolled-over) weekly window.
      await prisma.user.update({ where: { id: uid }, data: { boostsUsed: a.used + 1, boostWindowStart: a.windowStart } });
    }

    const current = await prisma.server.findUnique({ where: { id }, select: { boostCount: true } });
    const boostCount = (current?.boostCount ?? 0) + 1;
    const server = await prisma.server.update({
      where: { id },
      data: { boostCount, boostLevel: boostLevelFor(boostCount) },
      select: { boostCount: true, boostLevel: true },
    });
    await prisma.auditLog.create({ data: { serverId: id, actorId: uid, action: "server.boost", metadata: { boostCount: server.boostCount, boostLevel: server.boostLevel } } });
    app.io.to(room.server(id)).emit("server:boost", { serverId: id, boostCount: server.boostCount, boostLevel: server.boostLevel });
    return { server, boosts: { available: a.available === Infinity ? null : a.available - 1, max: a.max === Infinity ? null : a.max } };
  });

  // Welcome/guide screen (rules + greeting) — readable by any member.
  app.get("/servers/:id/guide", async (req) => {
    const { id } = req.params as { id: string };
    await resolveMember(id, userId(req));
    const server = await prisma.server.findUnique({
      where: { id },
      select: { name: true, description: true, iconUrl: true, rules: true, welcomeMessage: true },
    });
    if (!server) throw Errors.notFound("Server not found");
    return { guide: server };
  });

  app.put("/servers/:id/guide", async (req) => {
    const { id } = req.params as { id: string };
    await requirePermission(id, userId(req), Permission.MANAGE_SERVER);
    const body = updateGuideSchema.parse(req.body);
    const server = await prisma.server.update({
      where: { id },
      data: { rules: body.rules, welcomeMessage: body.welcomeMessage },
      select: { rules: true, welcomeMessage: true },
    });
    return { guide: server };
  });

  app.delete("/servers/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const ctx = await resolveMember(id, userId(req));
    if (!ctx.isOwner) throw Errors.forbidden("Only the owner can delete the server");
    await prisma.server.delete({ where: { id } });
    return reply.code(204).send();
  });
}
