import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { prisma } from "@solarcord/db";
import { createInviteSchema, Permission } from "@solarcord/shared";
import { Errors } from "../errors.js";
import { requireAuth, userId } from "../auth.js";
import { requirePermission, resolveMember } from "../permissions.js";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

function generateCode(len = 8): string {
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i]! % ALPHABET.length];
  return out;
}

async function uniqueCode(): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const code = generateCode();
    const clash = await prisma.invite.findUnique({ where: { code }, select: { id: true } });
    if (!clash) return code;
  }
  throw Errors.conflict("Could not generate an invite code, try again");
}

export async function inviteRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  // Create an invite for a server.
  app.post("/servers/:id/invites", async (req, reply) => {
    const { id } = req.params as { id: string };
    await requirePermission(id, userId(req), Permission.CREATE_INVITE);
    const body = createInviteSchema.parse(req.body ?? {});

    const code = await uniqueCode();
    const expiresAt =
      body.expiresInHours && body.expiresInHours > 0
        ? new Date(Date.now() + body.expiresInHours * 3_600_000)
        : null;

    const invite = await prisma.invite.create({
      data: {
        code,
        serverId: id,
        inviterId: userId(req),
        maxUses: body.maxUses && body.maxUses > 0 ? body.maxUses : null,
        expiresAt,
      },
    });
    return reply.code(201).send({ invite: { code: invite.code, expiresAt: invite.expiresAt, maxUses: invite.maxUses } });
  });

  // Preview an invite (server name, member count) before joining.
  app.get("/invites/:code", async (req) => {
    const { code } = req.params as { code: string };
    const invite = await prisma.invite.findUnique({
      where: { code },
      include: { server: { select: { id: true, name: true, iconUrl: true, memberCount: true } } },
    });
    if (!invite) throw Errors.notFound("This invite is invalid or has expired");

    const expired = invite.expiresAt ? invite.expiresAt < new Date() : false;
    const maxed = invite.maxUses ? invite.uses >= invite.maxUses : false;

    return {
      invite: {
        code: invite.code,
        valid: !expired && !maxed,
        server: invite.server,
      },
    };
  });

  // Accept an invite → join the server.
  app.post("/invites/:code/join", async (req) => {
    const { code } = req.params as { code: string };
    const uid = userId(req);
    const invite = await prisma.invite.findUnique({ where: { code } });
    if (!invite) throw Errors.notFound("This invite is invalid or has expired");
    if (invite.expiresAt && invite.expiresAt < new Date()) throw Errors.forbidden("This invite has expired");
    if (invite.maxUses && invite.uses >= invite.maxUses) throw Errors.forbidden("This invite has reached its limit");

    const banned = await prisma.ban.findUnique({
      where: { serverId_userId: { serverId: invite.serverId, userId: uid } },
      select: { id: true },
    });
    if (banned) throw Errors.forbidden("You are banned from this server");

    // Already a member? No-op success.
    const existing = await prisma.serverMember.findUnique({
      where: { serverId_userId: { serverId: invite.serverId, userId: uid } },
      select: { id: true },
    });
    if (existing) return { serverId: invite.serverId, alreadyMember: true };

    await prisma.$transaction([
      prisma.serverMember.create({ data: { serverId: invite.serverId, userId: uid } }),
      prisma.server.update({ where: { id: invite.serverId }, data: { memberCount: { increment: 1 } } }),
      prisma.invite.update({ where: { id: invite.id }, data: { uses: { increment: 1 } } }),
    ]);

    return { serverId: invite.serverId, alreadyMember: false };
  });

  // List a server's active invites (manage server).
  app.get("/servers/:id/invites", async (req) => {
    const { id } = req.params as { id: string };
    await resolveMember(id, userId(req));
    const invites = await prisma.invite.findMany({
      where: { serverId: id },
      orderBy: { createdAt: "desc" },
      select: { code: true, uses: true, maxUses: true, expiresAt: true, createdAt: true },
    });
    return { invites };
  });
}
