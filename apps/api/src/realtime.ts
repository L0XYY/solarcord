import type { Server as HttpServer } from "node:http";
import { Server as IOServer } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { prisma } from "@solarcord/db";
import {
  type ClientToServerEvents,
  type ServerToClientEvents,
  room,
  Permission,
  has,
} from "@solarcord/shared";
import { verifyAccessToken } from "./tokens.js";
import { redisPub, redisSub } from "./redis.js";
import { resolveMember, resolveChannelPermissions } from "./permissions.js";
import { env } from "./env.js";

interface SocketData {
  userId: string;
  username?: string;
  displayName?: string | null;
  avatarUrl?: string | null;
}

export type AppIO = IOServer<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

export function createGateway(httpServer: HttpServer): AppIO {
  const io: AppIO = new IOServer(httpServer, {
    cors: { origin: env.WEB_ORIGIN, credentials: true },
  });

  io.adapter(createAdapter(redisPub, redisSub));

  // Track which voice rooms each socket is in (kept OUT of socket.data so the
  // Redis adapter's fetchSockets() serialization doesn't choke on a Set).
  const voiceMembership = new Map<string, Set<string>>();

  // Authenticate every socket via its access token.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error("UNAUTHORIZED"));
    try {
      socket.data.userId = verifyAccessToken(token).sub;
      next();
    } catch {
      next(new Error("UNAUTHORIZED"));
    }
  });

  io.on("connection", async (socket) => {
    const uid = socket.data.userId;
    socket.join(room.user(uid));

    const memberships = await prisma.serverMember.findMany({
      where: { userId: uid },
      include: { server: { select: { id: true, name: true } } },
    });
    for (const m of memberships) socket.join(room.server(m.serverId));

    // Join all DM conversation rooms so direct messages arrive in real time.
    const convos = await prisma.conversationParticipant.findMany({
      where: { userId: uid },
      select: { conversationId: true },
    });
    for (const c of convos) socket.join(room.dm(c.conversationId));

    const user = await prisma.user.findUnique({
      where: { id: uid },
      select: { id: true, username: true, displayName: true, avatarUrl: true, status: true },
    });
    if (user) {
      socket.data.username = user.username;
      socket.data.displayName = user.displayName;
      socket.data.avatarUrl = user.avatarUrl;
    }
    if (user) {
      // Mark online and tell their servers.
      await prisma.user.update({ where: { id: uid }, data: { status: "ONLINE" } }).catch(() => {});
      socket.emit("ready", {
        user: { ...user, status: "ONLINE" },
        servers: memberships.map((m) => m.server),
      });
      for (const m of memberships) {
        socket.to(room.server(m.serverId)).emit("presence:update", { userId: uid, status: "ONLINE" });
      }
    }

    // Join a channel room after verifying VIEW_CHANNEL.
    socket.on("channel:focus", async ({ channelId }) => {
      try {
        const channel = await prisma.channel.findUnique({
          where: { id: channelId },
          select: { serverId: true },
        });
        if (!channel) return;
        const ctx = await resolveMember(channel.serverId, uid);
        const perms = ctx.isOwner ? null : await resolveChannelPermissions(ctx, channelId);
        if (ctx.isOwner || has(perms!, Permission.VIEW_CHANNEL)) {
          socket.join(room.channel(channelId));
        } else {
          socket.emit("error", { code: "FORBIDDEN", message: "Cannot view this channel" });
        }
      } catch {
        socket.emit("error", { code: "FORBIDDEN", message: "Cannot view this channel" });
      }
    });

    socket.on("channel:blur", ({ channelId }) => {
      socket.leave(room.channel(channelId));
    });

    socket.on("typing:start", ({ channelId }) => {
      socket.to(room.channel(channelId)).emit("typing:start", { channelId, userId: uid });
    });

    // DM conversation rooms. Verify participation before joining/broadcasting.
    socket.on("conversation:focus", async ({ conversationId }) => {
      const p = await prisma.conversationParticipant.findUnique({
        where: { conversationId_userId: { conversationId, userId: uid } },
        select: { id: true },
      });
      if (p) socket.join(room.dm(conversationId));
    });
    socket.on("conversation:blur", ({ conversationId }) => {
      socket.leave(room.dm(conversationId));
    });
    socket.on("conversation:typing", ({ conversationId }) => {
      socket.to(room.dm(conversationId)).emit("typing:start", { channelId: conversationId, userId: uid });
    });

    socket.on("presence:update", async ({ status }) => {
      await prisma.user.update({ where: { id: uid }, data: { status } }).catch(() => {});
      for (const m of memberships) {
        socket.to(room.server(m.serverId)).emit("presence:update", { userId: uid, status });
      }
    });

    // ── Voice (WebRTC signalling) ──
    const peerOf = () => ({
      socketId: socket.id,
      userId: uid,
      username: socket.data.username ?? "",
      displayName: socket.data.displayName ?? null,
      avatarUrl: socket.data.avatarUrl ?? null,
    });

    socket.on("voice:join", async ({ roomId }) => {
      const vr = room.voice(roomId);
      const existing = await io.in(vr).fetchSockets().catch(() => []);
      socket.join(vr);
      let set = voiceMembership.get(socket.id);
      if (!set) voiceMembership.set(socket.id, (set = new Set()));
      set.add(roomId);
      socket.emit("voice:peers", {
        roomId,
        peers: existing
          .filter((s) => s.id !== socket.id)
          .map((s) => ({
            socketId: s.id,
            userId: s.data.userId,
            username: s.data.username ?? "",
            displayName: s.data.displayName ?? null,
            avatarUrl: s.data.avatarUrl ?? null,
          })),
      });
      socket.to(vr).emit("voice:peer-joined", { roomId, peer: peerOf() });
    });

    socket.on("voice:leave", ({ roomId }) => {
      socket.leave(room.voice(roomId));
      voiceMembership.get(socket.id)?.delete(roomId);
      socket.to(room.voice(roomId)).emit("voice:peer-left", { roomId, socketId: socket.id });
    });

    socket.on("voice:signal", ({ to, signal }) => {
      io.to(to).emit("voice:signal", { from: socket.id, signal });
    });

    socket.on("voice:state", ({ roomId, muted, deafened }) => {
      socket.to(room.voice(roomId)).emit("voice:state", { roomId, userId: uid, muted, deafened });
    });

    // Ring the other participants of a DM conversation.
    socket.on("voice:call", async ({ conversationId }) => {
      const parts = await prisma.conversationParticipant.findMany({
        where: { conversationId },
        select: { userId: true },
      });
      if (!parts.some((p) => p.userId === uid)) return;
      for (const p of parts) {
        if (p.userId !== uid) io.to(room.user(p.userId)).emit("voice:incoming", { conversationId, from: peerOf() });
      }
    });

    socket.on("disconnect", async () => {
      // Notify voice peers this socket dropped.
      for (const roomId of voiceMembership.get(socket.id) ?? []) {
        socket.to(room.voice(roomId)).emit("voice:peer-left", { roomId, socketId: socket.id });
      }
      voiceMembership.delete(socket.id);
      // If this was the user's last socket, mark offline.
      const remaining = await io.in(room.user(uid)).fetchSockets();
      if (remaining.length === 0) {
        await prisma.user.update({ where: { id: uid }, data: { status: "OFFLINE" } }).catch(() => {});
        for (const m of memberships) {
          socket.to(room.server(m.serverId)).emit("presence:update", { userId: uid, status: "OFFLINE" });
        }
      }
    });
  });

  return io;
}
