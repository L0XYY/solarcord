import type { FastifyInstance } from "fastify";
import { prisma } from "@solarcord/db";
import { banSchema, timeoutSchema, auditLogQuery, warnSchema, modNoteSchema, Permission } from "@solarcord/shared";
import { Errors } from "../errors.js";
import { requireAuth, userId } from "../auth.js";
import { requirePermission, resolveMember, type MemberContext } from "../permissions.js";

const pubSelect = { id: true, username: true, displayName: true, avatarUrl: true, status: true } as const;

// The actor must outrank the target, and the target cannot be the owner.
// Self-targeting is rejected by each handler before this is called.
async function assertCanModerate(actor: MemberContext, serverId: string, targetUserId: string) {
  const target = await resolveMember(serverId, targetUserId);
  if (target.isOwner) throw Errors.forbidden("You cannot moderate the server owner");
  if (!actor.isOwner && target.highestPosition >= actor.highestPosition) {
    throw Errors.forbidden("That member is equal to or above you in the role hierarchy");
  }
  return target;
}

export async function moderationRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  // Kick a member.
  app.delete("/servers/:id/members/:userId", async (req, reply) => {
    const { id, userId: targetId } = req.params as { id: string; userId: string };
    const uid = userId(req);
    if (targetId === uid) throw Errors.validation("Use 'leave server' to remove yourself");
    const actor = await requirePermission(id, uid, Permission.KICK_MEMBERS);
    await assertCanModerate(actor, id, targetId);

    await prisma.serverMember.delete({ where: { serverId_userId: { serverId: id, userId: targetId } } });
    await prisma.server.update({ where: { id }, data: { memberCount: { decrement: 1 } } });
    await prisma.auditLog.create({ data: { serverId: id, actorId: uid, action: "member.kick", targetId } });
    return reply.code(204).send();
  });

  // Ban list.
  app.get("/servers/:id/bans", async (req) => {
    const { id } = req.params as { id: string };
    await requirePermission(id, userId(req), Permission.BAN_MEMBERS);
    const bans = await prisma.ban.findMany({
      where: { serverId: id },
      include: { user: { select: pubSelect } },
      orderBy: { createdAt: "desc" },
    });
    return { bans: bans.map((b) => ({ user: b.user, reason: b.reason, createdAt: b.createdAt.toISOString() })) };
  });

  // Ban a member.
  app.post("/servers/:id/bans", async (req, reply) => {
    const { id } = req.params as { id: string };
    const uid = userId(req);
    const body = banSchema.parse(req.body);
    if (body.userId === uid) throw Errors.validation("You cannot ban yourself");
    const actor = await requirePermission(id, uid, Permission.BAN_MEMBERS);

    const isMember = await prisma.serverMember.findUnique({
      where: { serverId_userId: { serverId: id, userId: body.userId } },
      select: { id: true },
    });
    if (isMember) await assertCanModerate(actor, id, body.userId);

    await prisma.$transaction(async (tx) => {
      await tx.ban.upsert({
        where: { serverId_userId: { serverId: id, userId: body.userId } },
        update: { reason: body.reason, bannedById: uid },
        create: { serverId: id, userId: body.userId, reason: body.reason, bannedById: uid },
      });
      if (isMember) {
        await tx.serverMember.delete({ where: { serverId_userId: { serverId: id, userId: body.userId } } });
        await tx.server.update({ where: { id }, data: { memberCount: { decrement: 1 } } });
      }
      if (body.deleteMessageDays && body.deleteMessageDays > 0) {
        const since = new Date(Date.now() - body.deleteMessageDays * 86_400_000);
        await tx.message.deleteMany({
          where: { authorId: body.userId, createdAt: { gte: since }, channel: { serverId: id } },
        });
      }
    });
    await prisma.auditLog.create({
      data: {
        serverId: id,
        actorId: uid,
        action: "member.ban",
        targetId: body.userId,
        metadata: { reason: body.reason ?? null },
      },
    });
    return reply.code(201).send({ ok: true });
  });

  // Unban.
  app.delete("/servers/:id/bans/:userId", async (req, reply) => {
    const { id, userId: targetId } = req.params as { id: string; userId: string };
    const uid = userId(req);
    await requirePermission(id, uid, Permission.BAN_MEMBERS);
    await prisma.ban.deleteMany({ where: { serverId: id, userId: targetId } });
    await prisma.auditLog.create({ data: { serverId: id, actorId: uid, action: "member.unban", targetId } });
    return reply.code(204).send();
  });

  // Timeout (mute) a member, or clear it with minutes: 0.
  app.post("/servers/:id/members/:userId/timeout", async (req) => {
    const { id, userId: targetId } = req.params as { id: string; userId: string };
    const uid = userId(req);
    const body = timeoutSchema.parse(req.body);
    if (targetId === uid) throw Errors.validation("You cannot time yourself out");
    const actor = await requirePermission(id, uid, Permission.TIMEOUT_MEMBERS);
    await assertCanModerate(actor, id, targetId);

    const until = body.minutes > 0 ? new Date(Date.now() + body.minutes * 60_000) : null;
    await prisma.serverMember.update({
      where: { serverId_userId: { serverId: id, userId: targetId } },
      data: { timeoutUntil: until },
    });
    await prisma.auditLog.create({
      data: { serverId: id, actorId: uid, action: until ? "member.timeout" : "member.timeout_remove", targetId },
    });
    return { timeoutUntil: until ? until.toISOString() : null };
  });

  // Warn a member.
  app.post("/servers/:id/members/:userId/warnings", async (req, reply) => {
    const { id, userId: targetId } = req.params as { id: string; userId: string };
    const uid = userId(req);
    if (targetId === uid) throw Errors.validation("You can't warn yourself");
    const actor = await requirePermission(id, uid, Permission.KICK_MEMBERS);
    await assertCanModerate(actor, id, targetId);
    const body = warnSchema.parse(req.body);

    await prisma.warning.create({ data: { serverId: id, userId: targetId, moderatorId: uid, reason: body.reason } });
    await prisma.auditLog.create({ data: { serverId: id, actorId: uid, action: "member.warn", targetId } });
    return reply.code(201).send({ ok: true });
  });

  app.delete("/servers/:id/warnings/:warningId", async (req, reply) => {
    const { id, warningId } = req.params as { id: string; warningId: string };
    await requirePermission(id, userId(req), Permission.KICK_MEMBERS);
    await prisma.warning.deleteMany({ where: { id: warningId, serverId: id } });
    return reply.code(204).send();
  });

  // Add a private moderator note about a member.
  app.post("/servers/:id/members/:userId/notes", async (req, reply) => {
    const { id, userId: targetId } = req.params as { id: string; userId: string };
    const uid = userId(req);
    await requirePermission(id, uid, Permission.KICK_MEMBERS);
    const body = modNoteSchema.parse(req.body);
    await prisma.modNote.create({ data: { serverId: id, userId: targetId, authorId: uid, content: body.content } });
    return reply.code(201).send({ ok: true });
  });

  // Moderation history for a member (warnings + notes).
  app.get("/servers/:id/members/:userId/moderation", async (req) => {
    const { id, userId: targetId } = req.params as { id: string; userId: string };
    await requirePermission(id, userId(req), Permission.KICK_MEMBERS);

    const [warnings, notes] = await Promise.all([
      prisma.warning.findMany({ where: { serverId: id, userId: targetId }, orderBy: { createdAt: "desc" } }),
      prisma.modNote.findMany({ where: { serverId: id, userId: targetId }, orderBy: { createdAt: "desc" } }),
    ]);

    const actorIds = [...new Set([...warnings.map((w) => w.moderatorId), ...notes.map((n) => n.authorId)])];
    const actors = await prisma.user.findMany({ where: { id: { in: actorIds } }, select: pubSelect });
    const byId = new Map(actors.map((a) => [a.id, a]));

    return {
      warnings: warnings.map((w) => ({ id: w.id, reason: w.reason, by: byId.get(w.moderatorId) ?? null, createdAt: w.createdAt.toISOString() })),
      notes: notes.map((n) => ({ id: n.id, content: n.content, by: byId.get(n.authorId) ?? null, createdAt: n.createdAt.toISOString() })),
    };
  });

  // Audit log.
  app.get("/servers/:id/audit-logs", async (req) => {
    const { id } = req.params as { id: string };
    const q = auditLogQuery.parse(req.query);
    await requirePermission(id, userId(req), Permission.VIEW_AUDIT_LOG);

    const logs = await prisma.auditLog.findMany({
      where: { serverId: id, ...(q.before ? { id: { lt: q.before } } : {}) },
      include: { actor: { select: pubSelect } },
      orderBy: { createdAt: "desc" },
      take: q.limit,
    });
    return {
      logs: logs.map((l) => ({
        id: l.id,
        action: l.action,
        actor: l.actor,
        targetId: l.targetId,
        metadata: l.metadata,
        createdAt: l.createdAt.toISOString(),
      })),
    };
  });
}
