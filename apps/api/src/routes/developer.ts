import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import argon2 from "argon2";
import { prisma } from "@solarcord/db";
import { createBotAppSchema, addBotSchema, Permission } from "@solarcord/shared";
import { Errors } from "../errors.js";
import { requireAuth, userId } from "../auth.js";
import { requirePermission } from "../permissions.js";

function genToken() {
  return `scbot_${randomBytes(24).toString("hex")}`;
}

function slugify(name: string) {
  const base = name.toLowerCase().replace(/[^a-z0-9_.]/g, "").slice(0, 20) || "bot";
  return `${base}_${randomBytes(3).toString("hex")}`;
}

export async function developerRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  // Bots can't manage other bots — these are developer-only endpoints.
  app.addHook("preHandler", async (req) => {
    if (req.isBot) throw Errors.forbidden("Bots can't use the developer API");
  });

  // List my bot applications.
  app.get("/developer/apps", async (req) => {
    const apps = await prisma.botApplication.findMany({
      where: { ownerId: userId(req) },
      orderBy: { createdAt: "desc" },
    });
    const botUsers = await prisma.user.findMany({
      where: { id: { in: apps.map((a) => a.botUserId) } },
      select: { id: true, username: true, avatarUrl: true },
    });
    const byId = new Map(botUsers.map((u) => [u.id, u]));
    return {
      apps: apps.map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        token: a.token,
        bot: byId.get(a.botUserId) ?? null,
        createdAt: a.createdAt.toISOString(),
      })),
    };
  });

  // Create a bot application (+ its backing bot user).
  app.post("/developer/apps", async (req, reply) => {
    const uid = userId(req);
    const body = createBotAppSchema.parse(req.body);

    const botUser = await prisma.user.create({
      data: {
        email: `bot-${randomBytes(8).toString("hex")}@bots.solarcord.invalid`,
        username: slugify(body.name),
        displayName: body.name,
        isBot: true,
        botOwnerId: uid,
        passwordHash: await argon2.hash(randomBytes(24).toString("hex"), { type: argon2.argon2id }),
      },
    });

    const application = await prisma.botApplication.create({
      data: { name: body.name, description: body.description, ownerId: uid, botUserId: botUser.id, token: genToken() },
    });
    return reply.code(201).send({
      app: { id: application.id, name: application.name, token: application.token, bot: { id: botUser.id, username: botUser.username } },
    });
  });

  // Reset a bot's token.
  app.post("/developer/apps/:id/reset-token", async (req) => {
    const { id } = req.params as { id: string };
    const found = await prisma.botApplication.findFirst({ where: { id, ownerId: userId(req) }, select: { id: true } });
    if (!found) throw Errors.notFound("Application not found");
    const updated = await prisma.botApplication.update({ where: { id }, data: { token: genToken() } });
    return { token: updated.token };
  });

  // Delete a bot application (and its bot user + memberships via cascade).
  app.delete("/developer/apps/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const found = await prisma.botApplication.findFirst({ where: { id, ownerId: userId(req) } });
    if (!found) throw Errors.notFound("Application not found");
    await prisma.botApplication.delete({ where: { id } });
    await prisma.user.delete({ where: { id: found.botUserId } }).catch(() => {});
    return reply.code(204).send();
  });

  // Add one of my bots to a server I manage.
  app.post("/servers/:id/bots", async (req, reply) => {
    const { id } = req.params as { id: string };
    const uid = userId(req);
    await requirePermission(id, uid, Permission.MANAGE_SERVER);
    const body = addBotSchema.parse(req.body);

    const application = await prisma.botApplication.findFirst({
      where: { id: body.applicationId, ownerId: uid },
      select: { botUserId: true },
    });
    if (!application) throw Errors.notFound("Bot application not found");

    const existing = await prisma.serverMember.findUnique({
      where: { serverId_userId: { serverId: id, userId: application.botUserId } },
      select: { id: true },
    });
    if (existing) return reply.send({ ok: true, alreadyMember: true });

    await prisma.$transaction([
      prisma.serverMember.create({ data: { serverId: id, userId: application.botUserId } }),
      prisma.server.update({ where: { id }, data: { memberCount: { increment: 1 } } }),
    ]);
    await prisma.auditLog.create({ data: { serverId: id, actorId: uid, action: "bot.add", targetId: application.botUserId } });
    return reply.code(201).send({ ok: true });
  });
}
