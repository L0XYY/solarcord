import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";

// Seed uses scrypt (Node built-in) so it has zero extra deps; the API uses Argon2.
// Seeded accounts are for local demo only — log in, then change the password.
function hash(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding SolarCord demo data…");

  const platformBadges = [
    { key: "staff", name: "SolarCord Staff", description: "Member of the SolarCord team" },
    { key: "early_supporter", name: "Early Supporter", description: "Joined SolarCord early" },
    { key: "solar_plus", name: "Solar+ Subscriber", description: "Active Solar+ subscriber" },
    { key: "bug_hunter", name: "Bug Hunter", description: "Reported verified bugs" },
    { key: "active_developer", name: "Active Developer", description: "Maintains an active app" },
  ];
  for (const b of platformBadges) {
    await prisma.userBadge.upsert({ where: { key: b.key }, update: {}, create: b });
  }

  const nova = await prisma.user.upsert({
    where: { email: "nova@solarcord.dev" },
    update: {},
    create: {
      email: "nova@solarcord.dev",
      username: "nova",
      displayName: "Nova",
      passwordHash: hash("password123"),
      isStaff: true,
    },
  });

  // Demo servers owned by Nova — populate Discovery with badges.
  const demoServers = [
    { name: "Solar HQ", visibility: "COMMUNITY", category: "Tech", description: "The home base for SolarCord news, feedback and hangouts.", isVerified: true, isPartnered: false, boostLevel: 1, memberCount: 248 },
    { name: "Pixel Forge", visibility: "DISCOVERABLE", category: "Gaming", description: "A cosy community for indie game lovers and pixel artists.", isVerified: false, isPartnered: false, boostLevel: 2, memberCount: 132 },
    { name: "Code Nebula", visibility: "DISCOVERABLE", category: "Coding", description: "Developers helping developers — web, game dev, and everything in between.", isVerified: false, isPartnered: true, boostLevel: 0, memberCount: 87 },
    { name: "Aurora Art", visibility: "COMMUNITY", category: "Art", description: "Share your work, get feedback, and find inspiration.", isVerified: false, isPartnered: true, boostLevel: 0, memberCount: 64 },
  ];

  const existing = await prisma.server.findFirst({ where: { ownerId: nova.id } });
  if (!existing) {
    for (const s of demoServers) {
      const server = await prisma.server.create({
        data: {
          name: s.name,
          description: s.description,
          ownerId: nova.id,
          visibility: s.visibility as "COMMUNITY" | "DISCOVERABLE" | "PUBLIC" | "PRIVATE",
          category: s.category,
          isVerified: s.isVerified,
          isPartnered: s.isPartnered,
          boostLevel: s.boostLevel,
          memberCount: s.memberCount,
          members: { create: { userId: nova.id } },
          roles: { create: { name: "@everyone", isEveryone: true, permissions: "1024" } },
          channels: {
            create: [
              { name: "welcome", type: "TEXT", position: 0 },
              { name: "general", type: "TEXT", position: 1 },
              { name: "Lounge", type: "VOICE", position: 2 },
            ],
          },
        },
      });
      console.log(`Created demo server "${server.name}" (${server.id})`);
    }
  }

  console.log("Done. Demo login → nova@solarcord.dev / password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
