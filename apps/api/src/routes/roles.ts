import type { FastifyInstance } from "fastify";
import { prisma } from "@solarcord/db";
import { createRoleSchema, updateRoleSchema, Permission, toBits } from "@solarcord/shared";
import { Errors } from "../errors.js";
import { requireAuth, userId } from "../auth.js";
import { requirePermission, resolveMember, type MemberContext } from "../permissions.js";

// Non-owners can only grant permission bits they already hold.
function assertNoElevation(ctx: MemberContext, newPerms: string) {
  if (ctx.isOwner) return;
  const granted = toBits(newPerms) & ~toBits(ctx.basePermissions);
  if (granted !== 0n) throw Errors.forbidden("You can't grant permissions you don't have");
}

// Non-owners can only touch roles positioned below their own highest role.
function assertAboveRole(ctx: MemberContext, rolePosition: number) {
  if (ctx.isOwner) return;
  if (rolePosition >= ctx.highestPosition) {
    throw Errors.forbidden("You can't manage a role equal to or above your highest role");
  }
}

export async function roleRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get("/servers/:id/roles", async (req) => {
    const { id } = req.params as { id: string };
    await resolveMember(id, userId(req));
    const roles = await prisma.role.findMany({ where: { serverId: id }, orderBy: { position: "desc" } });
    return { roles };
  });

  app.post("/servers/:id/roles", async (req, reply) => {
    const { id } = req.params as { id: string };
    const ctx = await requirePermission(id, userId(req), Permission.MANAGE_ROLES);
    const body = createRoleSchema.parse(req.body);
    const perms = body.permissions ?? "0";
    assertNoElevation(ctx, perms);

    const top = await prisma.role.findFirst({ where: { serverId: id }, orderBy: { position: "desc" }, select: { position: true } });
    const role = await prisma.role.create({
      data: {
        serverId: id,
        name: body.name,
        color: body.color ?? 0,
        permissions: perms,
        position: (top?.position ?? 0) + 1,
      },
    });
    await prisma.auditLog.create({ data: { serverId: id, actorId: userId(req), action: "role.create", targetId: role.id } });
    return reply.code(201).send({ role });
  });

  app.patch("/roles/:id", async (req) => {
    const { id } = req.params as { id: string };
    const role = await prisma.role.findUnique({ where: { id } });
    if (!role) throw Errors.notFound("Role not found");
    const ctx = await requirePermission(role.serverId, userId(req), Permission.MANAGE_ROLES);
    assertAboveRole(ctx, role.position);

    const body = updateRoleSchema.parse(req.body);
    if (body.permissions !== undefined) assertNoElevation(ctx, body.permissions);
    if (role.isEveryone && body.name !== undefined && body.name !== role.name) {
      throw Errors.validation("The default role can't be renamed");
    }

    const updated = await prisma.role.update({
      where: { id },
      data: {
        name: body.name,
        color: body.color,
        permissions: body.permissions,
        iconUrl: body.iconUrl,
        isHoisted: body.hoisted,
        mentionable: body.mentionable,
      },
    });
    await prisma.auditLog.create({ data: { serverId: role.serverId, actorId: userId(req), action: "role.update", targetId: id } });
    return { role: updated };
  });

  app.delete("/roles/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const role = await prisma.role.findUnique({ where: { id } });
    if (!role) throw Errors.notFound("Role not found");
    if (role.isEveryone) throw Errors.validation("The default role can't be deleted");
    const ctx = await requirePermission(role.serverId, userId(req), Permission.MANAGE_ROLES);
    assertAboveRole(ctx, role.position);

    await prisma.role.delete({ where: { id } });
    await prisma.auditLog.create({ data: { serverId: role.serverId, actorId: userId(req), action: "role.delete", targetId: id } });
    return reply.code(204).send();
  });

  // Assign a role to a member.
  app.put("/servers/:id/members/:userId/roles/:roleId", async (req, reply) => {
    const { id, userId: targetUserId, roleId } = req.params as { id: string; userId: string; roleId: string };
    const ctx = await requirePermission(id, userId(req), Permission.MANAGE_ROLES);

    const role = await prisma.role.findFirst({ where: { id: roleId, serverId: id } });
    if (!role) throw Errors.notFound("Role not found");
    if (role.isEveryone) throw Errors.validation("The default role is applied to everyone automatically");
    assertAboveRole(ctx, role.position);

    const member = await prisma.serverMember.findUnique({
      where: { serverId_userId: { serverId: id, userId: targetUserId } },
      select: { id: true },
    });
    if (!member) throw Errors.notFound("Member not found");

    await prisma.memberRole.upsert({
      where: { memberId_roleId: { memberId: member.id, roleId } },
      update: {},
      create: { memberId: member.id, roleId },
    });
    return reply.code(204).send();
  });

  // Remove a role from a member.
  app.delete("/servers/:id/members/:userId/roles/:roleId", async (req, reply) => {
    const { id, userId: targetUserId, roleId } = req.params as { id: string; userId: string; roleId: string };
    const ctx = await requirePermission(id, userId(req), Permission.MANAGE_ROLES);

    const role = await prisma.role.findFirst({ where: { id: roleId, serverId: id } });
    if (!role) throw Errors.notFound("Role not found");
    assertAboveRole(ctx, role.position);

    const member = await prisma.serverMember.findUnique({
      where: { serverId_userId: { serverId: id, userId: targetUserId } },
      select: { id: true },
    });
    if (!member) throw Errors.notFound("Member not found");

    await prisma.memberRole.deleteMany({ where: { memberId: member.id, roleId } });
    return reply.code(204).send();
  });
}
