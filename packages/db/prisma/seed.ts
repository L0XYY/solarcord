import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";

// Seed uses scrypt (Node built-in) so it has zero extra deps; the API login
// verifies both scrypt and Argon2 hashes.
function hash(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

const prisma = new PrismaClient();

async function main() {
  // Keep the platform badge catalog (reference data, not user/server data).
  const platformBadges = [
    { key: "staff", name: "SolarCord Staff", description: "Member of the SolarCord team" },
    { key: "early_supporter", name: "Early Supporter", description: "Joined SolarCord early" },
    { key: "solar_plus", name: "Solar+ Subscriber", description: "Active Solar+ subscriber" },
    { key: "bug_hunter", name: "Bug Hunter", description: "Reported verified bugs" },
    { key: "active_developer", name: "Active Developer", description: "Maintains an active app" },
    { key: "moderator", name: "Moderator", description: "Trusted community moderator" },
    { key: "verified", name: "Verified", description: "A verified account" },
    { key: "owner", name: "Owner", description: "Founder of SolarCord" },
  ];
  for (const b of platformBadges) {
    await prisma.userBadge.upsert({ where: { key: b.key }, update: {}, create: b });
  }

  // One-time wipe: while the old demo account is still present, clear ALL
  // servers and users. After this runs once, the marker is gone, so anything
  // created afterwards is never touched again.
  const oldDemo = await prisma.user.findUnique({ where: { email: "nova@solarcord.dev" }, select: { id: true } });
  if (oldDemo) {
    console.log("Wiping all existing servers and users…");
    await prisma.report.deleteMany();
    await prisma.botApplication.deleteMany();
    await prisma.conversation.deleteMany(); // cascades participants + direct messages
    await prisma.server.deleteMany(); // cascades channels, messages, members, roles, invites, bans, etc.
    await prisma.userBadgeLink.deleteMany();
    await prisma.user.deleteMany(); // cascades sessions, settings, friendships
    console.log("Wipe complete.");
  }

  // Ensure the single owner account exists (and counts as a verified email).
  const loxy = await prisma.user.upsert({
    where: { email: "loxy@solarcord.app" },
    update: { emailVerified: true, emailDeadline: null },
    create: {
      email: "loxy@solarcord.app",
      username: "loxy",
      displayName: "loxy",
      passwordHash: hash("loxy12345"),
      isStaff: true,
      emailVerified: true,
    },
  });

  // Give every other not-yet-verified account a 1-week grace period to confirm a
  // real email (idempotent — only sets a deadline where none exists).
  await prisma.user.updateMany({
    where: { emailVerified: false, emailDeadline: null },
    data: { emailDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
  });

  // Loxy's badges — the Owner crown is exclusive to this account.
  for (const key of ["owner", "staff", "early_supporter", "verified"]) {
    const badge = await prisma.userBadge.findUnique({ where: { key }, select: { id: true } });
    if (badge) {
      await prisma.userBadgeLink.upsert({
        where: { userId_badgeId: { userId: loxy.id, badgeId: badge.id } },
        update: {},
        create: { userId: loxy.id, badgeId: badge.id },
      });
    }
  }

  console.log("Done. Owner login → loxy@solarcord.app / loxy12345");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
