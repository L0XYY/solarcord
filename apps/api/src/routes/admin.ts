import type { FastifyInstance } from "fastify";
import { prisma } from "@solarcord/db";
import {
  adminListQuery,
  reviewBadgeApplicationSchema,
  resolveReportSchema,
  verifyServerSchema,
  serverBadgeTypeSchema,
} from "@solarcord/shared";
import { Errors } from "../errors.js";
import { requireAuth, userId } from "../auth.js";

const pubSelect = { id: true, username: true, displayName: true, avatarUrl: true } as const;

// Gate: the authenticated user must be platform staff.
async function requireStaff(uid: string) {
  const u = await prisma.user.findUnique({ where: { id: uid }, select: { isStaff: true } });
  if (!u?.isStaff) throw Errors.forbidden("Staff only");
}

export async function adminRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);
  app.addHook("preHandler", async (req) => requireStaff(userId(req)));

  app.get("/admin/stats", async () => {
    const [users, servers, suspended, pendingApps, openReports] = await Promise.all([
      prisma.user.count(),
      prisma.server.count(),
      prisma.user.count({ where: { isSuspended: true } }),
      prisma.badgeApplication.count({ where: { status: "PENDING" } }),
      prisma.report.count({ where: { status: "OPEN" } }),
    ]);
    return { stats: { users, servers, suspended, pendingApps, openReports } };
  });

  // ── Users ──
  app.get("/admin/users", async (req) => {
    const q = adminListQuery.parse(req.query);
    const users = await prisma.user.findMany({
      where: q.q
        ? { OR: [{ username: { contains: q.q, mode: "insensitive" } }, { email: { contains: q.q, mode: "insensitive" } }] }
        : {},
      select: { id: true, username: true, displayName: true, email: true, isStaff: true, isSuspended: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: q.limit,
    });
    return { users: users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() })) };
  });

  app.post("/admin/users/:id/suspend", async (req) => {
    const { id } = req.params as { id: string };
    if (id === userId(req)) throw Errors.validation("You can't suspend yourself");
    await prisma.user.update({ where: { id }, data: { isSuspended: true } });
    await prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    return { ok: true };
  });

  app.post("/admin/users/:id/unsuspend", async (req) => {
    const { id } = req.params as { id: string };
    await prisma.user.update({ where: { id }, data: { isSuspended: false } });
    return { ok: true };
  });

  // ── Servers ──
  app.get("/admin/servers", async (req) => {
    const q = adminListQuery.parse(req.query);
    const servers = await prisma.server.findMany({
      where: q.q ? { name: { contains: q.q, mode: "insensitive" } } : {},
      select: {
        id: true,
        name: true,
        memberCount: true,
        visibility: true,
        isVerified: true,
        isPartnered: true,
        isRemoved: true,
        category: true,
        createdAt: true,
      },
      orderBy: { memberCount: "desc" },
      take: q.limit,
    });
    return { servers: servers.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() })) };
  });

  app.post("/admin/servers/:id/verify", async (req) => {
    const { id } = req.params as { id: string };
    const body = verifyServerSchema.parse(req.body);
    const server = await prisma.server.update({
      where: { id },
      data: { isVerified: body.isVerified, isPartnered: body.isPartnered },
      select: { id: true, isVerified: true, isPartnered: true },
    });
    // Keep explicit ServerBadge rows in sync with the verified/partnered flags.
    await syncFlagBadge(id, "VERIFIED", server.isVerified);
    await syncFlagBadge(id, "SOLAR_PARTNER", server.isPartnered);
    return { server };
  });

  app.post("/admin/servers/:id/remove", async (req) => {
    const { id } = req.params as { id: string };
    await prisma.server.update({ where: { id }, data: { isRemoved: true, visibility: "PRIVATE" } });
    return { ok: true };
  });

  // ── Badge applications ──
  app.get("/admin/badge-applications", async (req) => {
    const status = (req.query as { status?: string }).status ?? "PENDING";
    const apps = await prisma.badgeApplication.findMany({
      where: { status: status as "PENDING" | "APPROVED" | "REJECTED" | "REVOKED" },
      include: { server: { select: { id: true, name: true, iconUrl: true, memberCount: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return {
      applications: apps.map((a) => ({
        id: a.id,
        type: a.type,
        reason: a.reason,
        status: a.status,
        server: a.server,
        createdAt: a.createdAt.toISOString(),
      })),
    };
  });

  app.post("/admin/badge-applications/:id/review", async (req) => {
    const { id } = req.params as { id: string };
    const body = reviewBadgeApplicationSchema.parse(req.body);
    const application = await prisma.badgeApplication.findUnique({ where: { id } });
    if (!application || application.status !== "PENDING") throw Errors.notFound("Application not found");

    await prisma.badgeApplication.update({
      where: { id },
      data: { status: body.status, reviewNote: body.reviewNote, reviewerId: userId(req), reviewedAt: new Date() },
    });

    if (body.status === "APPROVED") {
      const type = serverBadgeTypeSchema.parse(application.type);
      await syncFlagBadge(application.serverId, type, true);
      if (type === "VERIFIED") await prisma.server.update({ where: { id: application.serverId }, data: { isVerified: true } });
      if (type === "SOLAR_PARTNER") await prisma.server.update({ where: { id: application.serverId }, data: { isPartnered: true } });
    }
    return { ok: true };
  });

  // ── Reports ──
  app.get("/admin/reports", async (req) => {
    const status = (req.query as { status?: string }).status ?? "OPEN";
    const reports = await prisma.report.findMany({
      where: { status: status as "OPEN" | "REVIEWING" | "RESOLVED" | "DISMISSED" },
      include: { reporter: { select: pubSelect } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return {
      reports: reports.map((r) => ({
        id: r.id,
        targetType: r.targetType,
        targetId: r.targetId,
        reason: r.reason,
        status: r.status,
        reporter: r.reporter,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  });

  app.post("/admin/reports/:id/resolve", async (req) => {
    const { id } = req.params as { id: string };
    const body = resolveReportSchema.parse(req.body);
    const report = await prisma.report.findUnique({ where: { id }, select: { id: true } });
    if (!report) throw Errors.notFound("Report not found");
    await prisma.report.update({ where: { id }, data: { status: body.status } });
    return { ok: true };
  });
}

async function syncFlagBadge(serverId: string, type: string, present: boolean | undefined) {
  if (present === undefined) return;
  if (present) {
    await prisma.serverBadge
      .upsert({
        where: { serverId_type: { serverId, type: type as never } },
        update: {},
        create: { serverId, type: type as never },
      })
      .catch(() => {});
  } else {
    await prisma.serverBadge.deleteMany({ where: { serverId, type: type as never } });
  }
}
