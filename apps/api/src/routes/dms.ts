import type { FastifyInstance } from "fastify";
import { prisma } from "@solarcord/db";
import {
  createDMSchema,
  createMessageSchema,
  editMessageSchema,
  messageHistoryQuery,
  room,
  type MessageDTO,
} from "@solarcord/shared";
import { Errors } from "../errors.js";
import { requireAuth, userId } from "../auth.js";
import { toPublicUser } from "../dto.js";

const pubSelect = { id: true, username: true, displayName: true, avatarUrl: true, status: true } as const;

const dmInclude = {
  author: { select: pubSelect },
  replyTo: {
    select: { id: true, content: true, author: { select: { id: true, username: true, displayName: true } } },
  },
} as const;

type DMRow = {
  id: string;
  conversationId: string;
  content: string;
  createdAt: Date;
  editedAt: Date | null;
  replyToId: string | null;
  author: { id: string; username: string; displayName: string | null; avatarUrl: string | null; status: string };
  replyTo: { id: string; content: string; author: { id: string; username: string; displayName: string | null } } | null;
};

// DM messages reuse MessageDTO; channelId carries the conversationId so the
// client can render them with the same ChatPanel. DMs have no reactions yet.
function toDMDto(m: DMRow): MessageDTO {
  return {
    id: m.id,
    channelId: m.conversationId,
    content: m.content,
    createdAt: m.createdAt.toISOString(),
    editedAt: m.editedAt ? m.editedAt.toISOString() : null,
    replyToId: m.replyToId,
    replyTo: m.replyTo ? { id: m.replyTo.id, content: m.replyTo.content, author: m.replyTo.author } : null,
    author: toPublicUser(m.author),
    reactions: [],
  };
}

async function assertParticipant(conversationId: string, uid: string) {
  const p = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId: uid } },
    select: { id: true },
  });
  if (!p) throw Errors.forbidden("You are not part of this conversation");
}

export async function dmRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  // List the current user's conversations with the other participants + last message.
  app.get("/dms", async (req) => {
    const uid = userId(req);
    const parts = await prisma.conversationParticipant.findMany({
      where: { userId: uid },
      include: {
        conversation: {
          include: {
            participants: { include: { user: { select: pubSelect } } },
            messages: { orderBy: { createdAt: "desc" }, take: 1, include: { author: { select: pubSelect } } },
          },
        },
      },
    });

    const conversations = parts
      .map((p) => p.conversation)
      .sort((a, b) => {
        const at = a.messages[0]?.createdAt.getTime() ?? a.createdAt.getTime();
        const bt = b.messages[0]?.createdAt.getTime() ?? b.createdAt.getTime();
        return bt - at;
      })
      .map((c) => ({
        id: c.id,
        isGroup: c.isGroup,
        name: c.name,
        iconUrl: c.iconUrl,
        participants: c.participants.filter((pp) => pp.userId !== uid).map((pp) => toPublicUser(pp.user)),
        lastMessage: c.messages[0]
          ? { content: c.messages[0].content, createdAt: c.messages[0].createdAt.toISOString() }
          : null,
      }));

    return { conversations };
  });

  // Open (or create) a conversation. 1 target → reuse existing 1:1; 2+ → new group.
  app.post("/dms", async (req, reply) => {
    const uid = userId(req);
    const body = createDMSchema.parse(req.body);
    const others = [...new Set(body.userIds)].filter((id) => id !== uid);
    if (others.length === 0) throw Errors.validation("Pick at least one other person");

    // Validate the targets exist.
    const found = await prisma.user.count({ where: { id: { in: others } } });
    if (found !== others.length) throw Errors.validation("One or more users were not found");

    const isGroup = others.length > 1;

    if (!isGroup) {
      // Reuse an existing 1:1 conversation if present.
      const existing = await prisma.conversation.findFirst({
        where: {
          isGroup: false,
          AND: [
            { participants: { some: { userId: uid } } },
            { participants: { some: { userId: others[0] } } },
          ],
        },
        include: { participants: { select: { userId: true } } },
      });
      if (existing && existing.participants.length === 2) {
        return reply.send({ conversation: { id: existing.id } });
      }
    }

    const participantIds = [uid, ...others];
    const conversation = await prisma.conversation.create({
      data: {
        isGroup,
        name: isGroup ? body.name ?? null : null,
        ownerId: isGroup ? uid : null,
        participants: { create: participantIds.map((id) => ({ userId: id })) },
      },
    });

    for (const pid of participantIds) {
      app.io.to(room.user(pid)).emit("conversation:new", { id: conversation.id });
    }
    return reply.code(201).send({ conversation: { id: conversation.id } });
  });

  app.get("/dms/:id/messages", async (req) => {
    const uid = userId(req);
    const { id } = req.params as { id: string };
    const q = messageHistoryQuery.parse(req.query);
    await assertParticipant(id, uid);

    const messages = await prisma.directMessage.findMany({
      where: { conversationId: id, ...(q.before ? { id: { lt: q.before } } : {}) },
      include: dmInclude,
      orderBy: { createdAt: "desc" },
      take: q.limit,
    });
    return { messages: messages.map(toDMDto) };
  });

  app.post("/dms/:id/messages", async (req, reply) => {
    const uid = userId(req);
    const { id } = req.params as { id: string };
    const body = createMessageSchema.parse(req.body);
    await assertParticipant(id, uid);

    if (body.replyToId) {
      const target = await prisma.directMessage.findFirst({
        where: { id: body.replyToId, conversationId: id },
        select: { id: true },
      });
      if (!target) throw Errors.validation("Reply target not in this conversation");
    }

    const message = await prisma.directMessage.create({
      data: { conversationId: id, authorId: uid, content: body.content, replyToId: body.replyToId },
      include: dmInclude,
    });
    const dto = toDMDto(message);
    app.io.to(room.dm(id)).emit("message:create", dto);
    return reply.code(201).send({ message: dto });
  });

  app.patch("/dms/:id/messages/:messageId", async (req) => {
    const uid = userId(req);
    const { id, messageId } = req.params as { id: string; messageId: string };
    const body = editMessageSchema.parse(req.body);
    await assertParticipant(id, uid);

    const existing = await prisma.directMessage.findFirst({
      where: { id: messageId, conversationId: id },
      select: { authorId: true },
    });
    if (!existing) throw Errors.notFound("Message not found");
    if (existing.authorId !== uid) throw Errors.forbidden("You can only edit your own messages");

    const updated = await prisma.directMessage.update({
      where: { id: messageId },
      data: { content: body.content, editedAt: new Date() },
      include: dmInclude,
    });
    const dto = toDMDto(updated);
    app.io.to(room.dm(id)).emit("message:update", dto);
    return { message: dto };
  });

  app.delete("/dms/:id/messages/:messageId", async (req, reply) => {
    const uid = userId(req);
    const { id, messageId } = req.params as { id: string; messageId: string };
    await assertParticipant(id, uid);

    const existing = await prisma.directMessage.findFirst({
      where: { id: messageId, conversationId: id },
      select: { authorId: true },
    });
    if (!existing) throw Errors.notFound("Message not found");
    if (existing.authorId !== uid) throw Errors.forbidden("You can only delete your own messages");

    await prisma.directMessage.delete({ where: { id: messageId } });
    app.io.to(room.dm(id)).emit("message:delete", { id: messageId, channelId: id });
    return reply.code(204).send();
  });
}
