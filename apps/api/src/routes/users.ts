import type { FastifyInstance } from "fastify";
import { prisma } from "@solarcord/db";
import { updateMeSchema, changeEmailSchema, room } from "@solarcord/shared";
import { Errors } from "../errors.js";
import { requireAuth, userId } from "../auth.js";
import { toSelfUser } from "../dto.js";
import { newVerifyToken, verifyLink, sendVerificationEmail, VERIFY_DEADLINE_MS } from "../email.js";

export async function userRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  // Activate Solar+ for the current user (grants the solar_plus badge → boosts,
  // themes, the badge on your profile). No billing wired up yet, so this just
  // turns it on.
  app.post("/users/me/solar-plus", async (req) => {
    const uid = userId(req);
    const badge = await prisma.userBadge.findUnique({ where: { key: "solar_plus" }, select: { id: true } });
    if (!badge) throw Errors.notFound("Solar+ isn't available right now");
    await prisma.userBadgeLink.upsert({
      where: { userId_badgeId: { userId: uid, badgeId: badge.id } },
      update: {},
      create: { userId: uid, badgeId: badge.id },
    });
    return { ok: true, solarPlus: true };
  });

  app.delete("/users/me/solar-plus", async (req) => {
    const uid = userId(req);
    const badge = await prisma.userBadge.findUnique({ where: { key: "solar_plus" }, select: { id: true } });
    if (badge) await prisma.userBadgeLink.deleteMany({ where: { userId: uid, badgeId: badge.id } });
    return { ok: true, solarPlus: false };
  });

  // Change email → restarts the verification flow with a fresh 1-week deadline.
  app.patch("/users/me/email", async (req) => {
    const uid = userId(req);
    const { email } = changeEmailSchema.parse(req.body);
    const lower = email.toLowerCase();
    const clash = await prisma.user.findFirst({ where: { email: lower, NOT: { id: uid } }, select: { id: true } });
    if (clash) throw Errors.conflict("That email is already in use.");
    const { token, expires } = newVerifyToken();
    const user = await prisma.user.update({
      where: { id: uid },
      data: {
        email: lower,
        emailVerified: false,
        emailVerifyToken: token,
        emailVerifyExpires: expires,
        emailDeadline: new Date(Date.now() + VERIFY_DEADLINE_MS),
      },
    });
    const link = verifyLink(token);
    const sent = await sendVerificationEmail(lower, link);
    return { user: toSelfUser(user), verifyLink: sent ? undefined : link };
  });

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
