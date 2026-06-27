import type { FastifyInstance } from "fastify";
import { prisma } from "@solarcord/db";
import { sendFriendRequestSchema, room } from "@solarcord/shared";
import { Errors } from "../errors.js";
import { requireAuth, userId } from "../auth.js";
import { toPublicUser } from "../dto.js";

const pubSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  status: true,
} as const;

export async function friendRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  // List friends + pending requests, split into incoming/outgoing.
  app.get("/friends", async (req) => {
    const uid = userId(req);
    const rows = await prisma.friendship.findMany({
      where: {
        OR: [{ requesterId: uid }, { addresseeId: uid }],
        status: { in: ["PENDING", "ACCEPTED"] },
      },
      include: { requester: { select: pubSelect }, addressee: { select: pubSelect } },
    });

    const friends = [];
    const incoming = [];
    const outgoing = [];
    for (const r of rows) {
      const other = r.requesterId === uid ? r.addressee : r.requester;
      if (r.status === "ACCEPTED") friends.push(toPublicUser(other));
      else if (r.requesterId === uid) outgoing.push({ id: r.id, user: toPublicUser(other) });
      else incoming.push({ id: r.id, user: toPublicUser(other) });
    }
    return { friends, incoming, outgoing };
  });

  // Send a friend request by username.
  app.post("/friends/requests", async (req, reply) => {
    const uid = userId(req);
    const { username } = sendFriendRequestSchema.parse(req.body);

    const target = await prisma.user.findUnique({ where: { username }, select: { id: true } });
    if (!target) throw Errors.notFound("No user with that username");
    if (target.id === uid) throw Errors.validation("You can't add yourself");

    // Any existing relationship in either direction?
    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: uid, addresseeId: target.id },
          { requesterId: target.id, addresseeId: uid },
        ],
      },
    });
    if (existing) {
      if (existing.status === "BLOCKED") throw Errors.forbidden("Unable to send request");
      if (existing.status === "ACCEPTED") throw Errors.conflict("You're already friends");
      // They already sent you one → accept it.
      if (existing.requesterId === target.id) {
        await prisma.friendship.update({ where: { id: existing.id }, data: { status: "ACCEPTED" } });
        app.io.to(room.user(target.id)).emit("friend:update");
        return reply.send({ status: "ACCEPTED" });
      }
      throw Errors.conflict("Request already pending");
    }

    await prisma.friendship.create({ data: { requesterId: uid, addresseeId: target.id, status: "PENDING" } });
    const me = await prisma.user.findUnique({ where: { id: uid }, select: pubSelect });
    if (me) app.io.to(room.user(target.id)).emit("friend:request", { from: toPublicUser(me) });
    return reply.code(201).send({ status: "PENDING" });
  });

  // Accept an incoming request (only the addressee may accept).
  app.post("/friends/requests/:id/accept", async (req) => {
    const uid = userId(req);
    const { id } = req.params as { id: string };
    const fr = await prisma.friendship.findUnique({ where: { id } });
    if (!fr || fr.addresseeId !== uid || fr.status !== "PENDING") throw Errors.notFound("Request not found");
    await prisma.friendship.update({ where: { id }, data: { status: "ACCEPTED" } });
    app.io.to(room.user(fr.requesterId)).emit("friend:update");
    return { status: "ACCEPTED" };
  });

  // Decline an incoming request OR cancel an outgoing one.
  app.delete("/friends/requests/:id", async (req, reply) => {
    const uid = userId(req);
    const { id } = req.params as { id: string };
    const fr = await prisma.friendship.findUnique({ where: { id } });
    if (!fr || (fr.addresseeId !== uid && fr.requesterId !== uid) || fr.status !== "PENDING") {
      throw Errors.notFound("Request not found");
    }
    await prisma.friendship.delete({ where: { id } });
    const other = fr.requesterId === uid ? fr.addresseeId : fr.requesterId;
    app.io.to(room.user(other)).emit("friend:update");
    return reply.code(204).send();
  });

  // Remove an existing friend.
  app.delete("/friends/:userId", async (req, reply) => {
    const uid = userId(req);
    const { userId: otherId } = req.params as { userId: string };
    await prisma.friendship.deleteMany({
      where: {
        status: "ACCEPTED",
        OR: [
          { requesterId: uid, addresseeId: otherId },
          { requesterId: otherId, addresseeId: uid },
        ],
      },
    });
    app.io.to(room.user(otherId)).emit("friend:update");
    return reply.code(204).send();
  });
}
