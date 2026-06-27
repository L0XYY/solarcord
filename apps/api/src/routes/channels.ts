import type { FastifyInstance } from "fastify";
import { prisma } from "@solarcord/db";
import { createChannelSchema, Permission, room } from "@solarcord/shared";
import { Errors } from "../errors.js";
import { requireAuth, userId } from "../auth.js";
import { requirePermission, resolveMember } from "../permissions.js";

export async function channelRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  // Create a channel in a server.
  app.post("/servers/:id/channels", async (req, reply) => {
    const { id } = req.params as { id: string };
    await requirePermission(id, userId(req), Permission.MANAGE_CHANNELS);
    const body = createChannelSchema.parse(req.body);

    const last = await prisma.channel.findFirst({
      where: { serverId: id },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const channel = await prisma.channel.create({
      data: {
        serverId: id,
        name: body.name,
        type: body.type,
        topic: body.topic,
        position: (last?.position ?? -1) + 1,
      },
    });

    await prisma.auditLog.create({
      data: { serverId: id, actorId: userId(req), action: "channel.create", targetId: channel.id },
    });

    app.io.to(room.server(id)).emit("server:channelCreate", {
      id: channel.id,
      serverId: channel.serverId,
      name: channel.name,
      type: channel.type,
      position: channel.position,
    });
    return reply.code(201).send({ channel });
  });

  app.patch("/channels/:id", async (req) => {
    const { id } = req.params as { id: string };
    const channel = await prisma.channel.findUnique({ where: { id }, select: { serverId: true } });
    if (!channel) throw Errors.notFound("Channel not found");
    await requirePermission(channel.serverId, userId(req), Permission.MANAGE_CHANNELS);

    const body = createChannelSchema.partial().parse(req.body);
    const updated = await prisma.channel.update({ where: { id }, data: body });
    return { channel: updated };
  });

  app.delete("/channels/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const channel = await prisma.channel.findUnique({ where: { id }, select: { serverId: true } });
    if (!channel) throw Errors.notFound("Channel not found");
    await requirePermission(channel.serverId, userId(req), Permission.MANAGE_CHANNELS);
    await prisma.channel.delete({ where: { id } });
    return reply.code(204).send();
  });
}

export { resolveMember };
