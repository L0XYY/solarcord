import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { prisma } from "@solarcord/db";
import { createWebhookSchema, executeWebhookSchema, Permission, room } from "@solarcord/shared";
import { Errors } from "../errors.js";
import { requireAuth, userId } from "../auth.js";
import { requirePermission } from "../permissions.js";
import { toMessageDTO } from "../dto.js";

const authorSelect = { id: true, username: true, displayName: true, avatarUrl: true, status: true } as const;

export async function webhookRoutes(app: FastifyInstance) {
  // ── Public execute endpoint (no auth — the token is the credential) ──
  app.post("/webhooks/:id/:token", async (req, reply) => {
    const { id, token } = req.params as { id: string; token: string };
    const body = executeWebhookSchema.parse(req.body);

    const webhook = await prisma.webhook.findUnique({ where: { id } });
    if (!webhook || webhook.token !== token) throw Errors.notFound("Unknown webhook");

    const message = await prisma.message.create({
      data: {
        channelId: webhook.channelId,
        authorId: webhook.createdById, // backing user for FK; display is overridden below
        content: body.content,
        webhookName: body.username ?? webhook.name,
        webhookAvatar: body.avatarUrl ?? webhook.avatarUrl,
      },
      include: { author: { select: authorSelect } },
    });

    const dto = toMessageDTO(message);
    app.io.to(room.channel(webhook.channelId)).emit("message:create", dto);
    return reply.code(204).send();
  });

  // ── Authed management routes ──
  await app.register(async (authed) => {
    authed.addHook("preHandler", requireAuth);

    // Create a webhook in a channel.
    authed.post("/channels/:id/webhooks", async (req, reply) => {
      const { id } = req.params as { id: string };
      const channel = await prisma.channel.findUnique({ where: { id }, select: { serverId: true } });
      if (!channel) throw Errors.notFound("Channel not found");
      await requirePermission(channel.serverId, userId(req), Permission.MANAGE_WEBHOOKS);
      const body = createWebhookSchema.parse(req.body);

      const webhook = await prisma.webhook.create({
        data: {
          channelId: id,
          serverId: channel.serverId,
          name: body.name,
          avatarUrl: body.avatarUrl,
          token: randomBytes(24).toString("hex"),
          createdById: userId(req),
        },
      });
      await prisma.auditLog.create({
        data: { serverId: channel.serverId, actorId: userId(req), action: "webhook.create", targetId: webhook.id },
      });
      return reply.code(201).send({
        webhook: { id: webhook.id, name: webhook.name, channelId: id, token: webhook.token },
      });
    });

    // List a server's webhooks.
    authed.get("/servers/:id/webhooks", async (req) => {
      const { id } = req.params as { id: string };
      await requirePermission(id, userId(req), Permission.MANAGE_WEBHOOKS);
      const webhooks = await prisma.webhook.findMany({
        where: { serverId: id },
        select: { id: true, name: true, channelId: true, token: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      });
      return { webhooks };
    });

    // Delete a webhook.
    authed.delete("/webhooks/:id", async (req, reply) => {
      const { id } = req.params as { id: string };
      const webhook = await prisma.webhook.findUnique({ where: { id }, select: { serverId: true } });
      if (!webhook) throw Errors.notFound("Webhook not found");
      await requirePermission(webhook.serverId, userId(req), Permission.MANAGE_WEBHOOKS);
      await prisma.webhook.delete({ where: { id } });
      return reply.code(204).send();
    });
  });
}
