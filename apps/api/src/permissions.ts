import { prisma } from "@solarcord/db";
import { combine, applyOverrides, has, Permission } from "@solarcord/shared";
import { Errors } from "./errors.js";

export interface MemberContext {
  serverId: string;
  memberId: string;
  isOwner: boolean;
  /** effective server-level permission bitfield (string) */
  basePermissions: string;
  /** highest role position the member holds (owner = Infinity) — for hierarchy checks */
  highestPosition: number;
  /** active timeout expiry, if the member is muted */
  timeoutUntil: Date | null;
}

/**
 * Resolve a user's membership + base (server-level) permissions.
 * Throws NOT_FOUND if the server is missing, FORBIDDEN if the user isn't a member.
 */
export async function resolveMember(serverId: string, uid: string): Promise<MemberContext> {
  const server = await prisma.server.findUnique({ where: { id: serverId }, select: { ownerId: true } });
  if (!server) throw Errors.notFound("Server not found");

  const member = await prisma.serverMember.findUnique({
    where: { serverId_userId: { serverId, userId: uid } },
    include: { roles: { include: { role: { select: { permissions: true, position: true } } } } },
  });
  if (!member) throw Errors.forbidden("You are not a member of this server");

  const everyone = await prisma.role.findFirst({
    where: { serverId, isEveryone: true },
    select: { permissions: true },
  });

  const isOwner = server.ownerId === uid;
  const rolePerms = member.roles.map((r) => r.role.permissions);
  const basePermissions = combine(everyone?.permissions ?? "0", ...rolePerms);
  const highestPosition = isOwner
    ? Number.MAX_SAFE_INTEGER
    : member.roles.reduce((max, r) => Math.max(max, r.role.position), 0);

  return {
    serverId,
    memberId: member.id,
    isOwner,
    basePermissions,
    highestPosition,
    timeoutUntil: member.timeoutUntil,
  };
}

/** Effective permissions for a member in a specific channel (applies overrides). */
export async function resolveChannelPermissions(
  ctx: MemberContext,
  channelId: string,
): Promise<string> {
  const overrides = await prisma.channelPermissionOverride.findMany({
    where: { channelId, OR: [{ memberId: ctx.memberId }, { roleId: { not: null } }] },
    select: { allow: true, deny: true },
  });
  return applyOverrides(ctx.basePermissions, overrides);
}

/**
 * Assert the user holds `perm` on the server. Owner & ADMINISTRATOR always pass.
 * Returns the MemberContext for reuse.
 */
export async function requirePermission(
  serverId: string,
  uid: string,
  perm: bigint,
): Promise<MemberContext> {
  const ctx = await resolveMember(serverId, uid);
  if (ctx.isOwner) return ctx;
  if (!has(ctx.basePermissions, perm)) {
    throw Errors.forbidden("Missing required permission");
  }
  return ctx;
}

export async function requireChannelPermission(
  serverId: string,
  channelId: string,
  uid: string,
  perm: bigint,
): Promise<MemberContext> {
  const ctx = await resolveMember(serverId, uid);
  if (ctx.isOwner) return ctx;
  const effective = await resolveChannelPermissions(ctx, channelId);
  if (!has(effective, perm)) throw Errors.forbidden("Missing required permission");
  return ctx;
}

export { Permission };
