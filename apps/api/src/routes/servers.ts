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
} from "@solarcord/shared";
import { Errors } from "../errors.js";
import { requireAuth, userId } from "../auth.js";
import { resolveMember, requirePermission } from "../permissions.js";

export async function serverRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

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

  // Boost the server (any member). Increments the count and recomputes the level.
  app.post("/servers/:id/boost", async (req) => {
    const { id } = req.params as { id: string };
    await resolveMember(id, userId(req));
    const current = await prisma.server.findUnique({ where: { id }, select: { boostCount: true } });
    const boostCount = (current?.boostCount ?? 0) + 1;
    const server = await prisma.server.update({
      where: { id },
      data: { boostCount, boostLevel: boostLevelFor(boostCount) },
      select: { boostCount: true, boostLevel: true },
    });
    return { server };
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
