import type { FastifyInstance } from "fastify";
import { prisma } from "@solarcord/db";
import { room } from "@solarcord/shared";
import { toMessageDTO } from "./dto.js";

const sysInclude = {
  author: { select: { id: true, username: true, displayName: true, avatarUrl: true, status: true } },
  reactions: { select: { emoji: true, userId: true } },
  replyTo: { select: { id: true, content: true, author: { select: { id: true, username: true, displayName: true } } } },
} as const;

// Post a SYSTEM message (join / boost notice) into a server's configured channel
// and broadcast it like any other message. No-ops gracefully if the channel is
// missing or not a text channel.
export async function postSystemMessage(app: FastifyInstance, channelId: string, authorId: string, content: string) {
  try {
    const channel = await prisma.channel.findUnique({ where: { id: channelId }, select: { type: true } });
    if (!channel || (channel.type !== "TEXT" && channel.type !== "ANNOUNCEMENT")) return;
    const message = await prisma.message.create({
      data: { channelId, authorId, content, type: "SYSTEM" },
      include: sysInclude,
    });
    app.io.to(room.channel(channelId)).emit("message:create", toMessageDTO(message));
  } catch {
    /* announcements are best-effort */
  }
}
