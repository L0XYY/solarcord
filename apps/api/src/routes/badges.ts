import type { FastifyInstance } from "fastify";
import { prisma } from "@solarcord/db";
import { createBadgeApplicationSchema, updateAutoModSchema, Permission } from "@solarcord/shared";
import { Errors } from "../errors.js";
import { requireAuth, userId } from "../auth.js";
import { requirePermission } from "../permissions.js";

export async function badgeRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  // Apply for a badge (server owner / manage server).
  app.post("/servers/:id/badge-applications", async (req, reply) => {
    const { id } = req.params as { id: string };
    await requirePermission(id, userId(req), Permission.MANAGE_SERVER);
    const body = createBadgeApplicationSchema.parse(req.body);

    const existingBadge = await prisma.serverBadge.findUnique({
      where: { serverId_type: { serverId: id, type: body.type } },
      select: { id: true },
    });
    if (existingBadge) throw Errors.conflict("Your server already has this badge");

    const pending = await prisma.badgeApplication.findFirst({
      where: { serverId: id, type: body.type, status: "PENDING" },
      select: { id: true },
    });
    if (pending) throw Errors.conflict("You already have a pending application for this badge");

    const application = await prisma.badgeApplication.create({
      data: { serverId: id, type: body.type, reason: body.reason, status: "PENDING" },
    });
    return reply.code(201).send({ application: { id: application.id, type: application.type, status: application.status } });
  });

  // List this server's badge applications + current badges.
  app.get("/servers/:id/badge-applications", async (req) => {
    const { id } = req.params as { id: string };
    await requirePermission(id, userId(req), Permission.MANAGE_SERVER);
    const [applications, badges] = await Promise.all([
      prisma.badgeApplication.findMany({
        where: { serverId: id },
        orderBy: { createdAt: "desc" },
        select: { id: true, type: true, status: true, reason: true, reviewNote: true, createdAt: true },
      }),
      prisma.serverBadge.findMany({ where: { serverId: id }, select: { type: true } }),
    ]);
    return {
      applications: applications.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
      badges: badges.map((b) => b.type),
    };
  });

  // AutoMod keyword list.
  app.get("/servers/:id/automod", async (req) => {
    const { id } = req.params as { id: string };
    await requirePermission(id, userId(req), Permission.MANAGE_SERVER);
    const server = await prisma.server.findUnique({ where: { id }, select: { bannedWords: true } });
    return { bannedWords: server?.bannedWords ?? [] };
  });

  app.put("/servers/:id/automod", async (req) => {
    const { id } = req.params as { id: string };
    await requirePermission(id, userId(req), Permission.MANAGE_SERVER);
    const body = updateAutoModSchema.parse(req.body);
    const normalized = [...new Set(body.bannedWords.map((w) => w.trim().toLowerCase()).filter(Boolean))];
    await prisma.server.update({ where: { id }, data: { bannedWords: normalized } });
    await prisma.auditLog.create({ data: { serverId: id, actorId: userId(req), action: "automod.update" } });
    return { bannedWords: normalized };
  });
}
