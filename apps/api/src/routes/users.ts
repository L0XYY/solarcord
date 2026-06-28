import type { FastifyInstance } from "fastify";
import { prisma } from "@solarcord/db";
import { updateMeSchema, room } from "@solarcord/shared";
import { Errors } from "../errors.js";
import { requireAuth, userId } from "../auth.js";
import { toSelfUser } from "../dto.js";

export async function userRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  // Update the current user's profile / status.
  app.patch("/users/me", async (req) => {
    const uid = userId(req);
    const body = updateMeSchema.parse(req.body);

    const user = await prisma.user.update({
      where: { id: uid },
      data: {
        displayName: body.displayName,
        bio: body.bio,
        pronouns: body.pronouns,
        avatarUrl: body.avatarUrl,
        bannerUrl: body.bannerUrl,
        customStatus: body.customStatus,
        status: body.status,
        themePrimary: body.themePrimary,
        themeAccent: body.themeAccent,
        tag: body.tag,
        tagBadge: body.tagBadge,
      },
    });

    // Broadcast a presence change to every server the user is in (invisible reads as offline).
    if (body.status) {
      const broadcast = body.status === "INVISIBLE" ? "OFFLINE" : body.status;
      const memberships = await prisma.serverMember.findMany({ where: { userId: uid }, select: { serverId: true } });
      for (const m of memberships) {
        app.io.to(room.server(m.serverId)).emit("presence:update", { userId: uid, status: broadcast });
      }
    }

    return { user: toSelfUser(user) };
  });

  // Public profile (for popout cards).
  app.get("/users/:id", async (req) => {
    const { id } = req.params as { id: string };
    const user = await prisma.user.findUnique({
      where: { id },
      include: { badges: { include: { badge: { select: { key: true, name: true, iconUrl: true } } } } },
    });
    if (!user) throw Errors.notFound("User not found");
    return {
      profile: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        bannerUrl: user.bannerUrl,
        bio: user.bio,
        pronouns: user.pronouns,
        status: user.status === "INVISIBLE" ? "OFFLINE" : user.status,
        themePrimary: user.themePrimary,
        themeAccent: user.themeAccent,
        tag: user.tag,
        tagBadge: user.tagBadge,
        isBot: user.isBot,
        isStaff: user.isStaff,
        badges: user.badges.map((b) => ({ key: b.badge.key, name: b.badge.name, iconUrl: b.badge.iconUrl })),
      },
    };
  });
}
