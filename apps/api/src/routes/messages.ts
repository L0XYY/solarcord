import type { FastifyInstance } from "fastify";
import { prisma } from "@solarcord/db";
import {
  createMessageSchema,
  editMessageSchema,
  reactionEmojiSchema,
  messageHistoryQuery,
  Permission,
  room,
} from "@solarcord/shared";
import { Errors } from "../errors.js";
import { requireAuth, userId } from "../auth.js";
import { requireChannelPermission, resolveMember } from "../permissions.js";
import { toMessageDTO } from "../dto.js";
import { has } from "@solarcord/shared";

const authorSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  status: true,
} as const;

// Shape used everywhere we return a message, so reactions + reply preview are consistent.
const messageInclude = {
  author: { select: authorSelect },
  reactions: { select: { emoji: true, userId: true } },
  replyTo: {
    select: {
      id: true,
      content: true,
      author: { select: { id: true, username: true, displayName: true } },
    },
  },
} as const;

async function channelServerId(channelId: string): Promise<string> {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: { serverId: true, type: true },
  });
  if (!channel) throw Errors.notFound("Channel not found");
  if (channel.type !== "TEXT" && channel.type !== "ANNOUNCEMENT") {
    throw Errors.validation("This channel does not accept text messages");
  }
  return channel.serverId;
}

// AutoMod: reject a message if it contains any banned keyword (whole-word, case-insensitive).
async function assertPassesAutoMod(serverId: string, content: string) {
  const server = await prisma.server.findUnique({ where: { id: serverId }, select: { bannedWords: true } });
  if (!server || server.bannedWords.length === 0) return;
  const lower = content.toLowerCase();
  const hit = server.bannedWords.find((w) => new RegExp(`\\b${escapeRegex(w)}\\b`, "i").test(lower));
  if (hit) throw Errors.forbidden("Your message was blocked by AutoMod");
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function messageRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  // Paginated history, newest first.
  app.get("/channels/:id/messages", async (req) => {
    const { id } = req.params as { id: string };
    const q = messageHistoryQuery.parse(req.query);
    const serverId = await channelServerId(id);
    await requireChannelPermission(serverId, id, userId(req), Permission.READ_HISTORY);

    const messages = await prisma.message.findMany({
      where: { channelId: id, ...(q.before ? { id: { lt: q.before } } : {}) },
      include: messageInclude,
      orderBy: { createdAt: "desc" },
      take: q.limit,
    });
    return { messages: messages.map(toMessageDTO) };
  });

  // Create a message → persist → broadcast to everyone focused on the channel.
  app.post("/channels/:id/messages", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = createMessageSchema.parse(req.body);
    const serverId = await channelServerId(id);
    const ctx = await requireChannelPermission(serverId, id, userId(req), Permission.SEND_MESSAGES);
    if (ctx.timeoutUntil && ctx.timeoutUntil > new Date()) {
      throw Errors.forbidden("You are timed out in this server");
    }
    await assertPassesAutoMod(serverId, body.content);

    if (body.replyToId) {
      const target = await prisma.message.findFirst({
        where: { id: body.replyToId, channelId: id },
        select: { id: true },
      });
      if (!target) throw Errors.validation("Reply target not in this channel");
    }

    const message = await prisma.message.create({
      data: {
        channelId: id,
        authorId: userId(req),
        content: body.content,
        type: body.replyToId ? "REPLY" : "DEFAULT",
        replyToId: body.replyToId,
      },
      include: messageInclude,
    });

    const dto = toMessageDTO(message);
    app.io.to(room.channel(id)).emit("message:create", dto);
    return reply.code(201).send({ message: dto });
  });

  // Edit — author only.
  app.patch("/channels/:id/messages/:messageId", async (req) => {
    const { id, messageId } = req.params as { id: string; messageId: string };
    const body = editMessageSchema.parse(req.body);
    const uid = userId(req);

    const existing = await prisma.message.findFirst({
      where: { id: messageId, channelId: id },
      select: { authorId: true },
    });
    if (!existing) throw Errors.notFound("Message not found");
    if (existing.authorId !== uid) throw Errors.forbidden("You can only edit your own messages");

    const updated = await prisma.message.update({
      where: { id: messageId },
      data: { content: body.content, editedAt: new Date() },
      include: messageInclude,
    });
    const dto = toMessageDTO(updated);
    app.io.to(room.channel(id)).emit("message:update", dto);
    return { message: dto };
  });

  // Delete — author, or anyone with MANAGE_MESSAGES.
  app.delete("/channels/:id/messages/:messageId", async (req, reply) => {
    const { id, messageId } = req.params as { id: string; messageId: string };
    const uid = userId(req);
    const serverId = await channelServerId(id);

    const existing = await prisma.message.findFirst({
      where: { id: messageId, channelId: id },
      select: { authorId: true },
    });
    if (!existing) throw Errors.notFound("Message not found");

    if (existing.authorId !== uid) {
      const ctx = await resolveMember(serverId, uid);
      if (!ctx.isOwner && !has(ctx.basePermissions, Permission.MANAGE_MESSAGES)) {
        throw Errors.forbidden("Missing permission to delete this message");
      }
      await prisma.auditLog.create({
        data: { serverId, actorId: uid, action: "message.delete", targetId: messageId },
      });
    }

    await prisma.message.delete({ where: { id: messageId } });
    app.io.to(room.channel(id)).emit("message:delete", { id: messageId, channelId: id });
    return reply.code(204).send();
  });

  // Add a reaction.
  app.put("/channels/:id/messages/:messageId/reactions/:emoji", async (req, reply) => {
    const { id, messageId, emoji } = req.params as { id: string; messageId: string; emoji: string };
    const decoded = reactionEmojiSchema.parse(decodeURIComponent(emoji));
    const serverId = await channelServerId(id);
    await requireChannelPermission(serverId, id, userId(req), Permission.ADD_REACTIONS);

    const exists = await prisma.message.findFirst({ where: { id: messageId, channelId: id }, select: { id: true } });
    if (!exists) throw Errors.notFound("Message not found");

    await prisma.reaction
      .create({ data: { messageId, userId: userId(req), emoji: decoded } })
      .catch(() => {}); // unique constraint = already reacted, idempotent

    app.io.to(room.channel(id)).emit("reaction:add", { channelId: id, messageId, emoji: decoded, userId: userId(req) });
    return reply.code(204).send();
  });

  // Remove own reaction.
  app.delete("/channels/:id/messages/:messageId/reactions/:emoji", async (req, reply) => {
    const { id, messageId, emoji } = req.params as { id: string; messageId: string; emoji: string };
    const decoded = reactionEmojiSchema.parse(decodeURIComponent(emoji));
    await channelServerId(id);

    await prisma.reaction.deleteMany({ where: { messageId, userId: userId(req), emoji: decoded } });
    app.io.to(room.channel(id)).emit("reaction:remove", { channelId: id, messageId, emoji: decoded, userId: userId(req) });
    return reply.code(204).send();
  });
}
