import type { FastifyInstance } from "fastify";
import { prisma } from "@solarcord/db";
import { discoveryQuery } from "@solarcord/shared";
import { Errors } from "../errors.js";
import { requireAuth, userId } from "../auth.js";

// Derive the badges a server should display from its flags + any explicit grants.
function deriveBadges(s: {
  isVerified: boolean;
  isPartnered: boolean;
  visibility: string;
  boostLevel: number;
  badges?: { type: string }[];
}): string[] {
  const out = new Set<string>();
  if (s.isVerified) out.add("VERIFIED");
  if (s.isPartnered) out.add("SOLAR_PARTNER");
  if (s.visibility === "COMMUNITY" || s.visibility === "DISCOVERABLE") out.add("COMMUNITY");
  if (s.visibility === "DISCOVERABLE") out.add("DISCOVERABLE");
  if (s.boostLevel > 0) out.add("BOOSTED");
  for (const b of s.badges ?? []) out.add(b.type);
  return [...out];
}

const cardSelect = {
  id: true,
  name: true,
  description: true,
  iconUrl: true,
  bannerUrl: true,
  category: true,
  visibility: true,
  isVerified: true,
  isPartnered: true,
  boostLevel: true,
  tag: true,
  tagBadge: true,
  memberCount: true,
  badges: { select: { type: true } },
} as const;

export async function discoveryRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  // Browse discoverable servers.
  app.get("/discovery", async (req) => {
    const q = discoveryQuery.parse(req.query);
    const servers = await prisma.server.findMany({
      where: {
        visibility: { in: ["PUBLIC", "COMMUNITY", "DISCOVERABLE"] },
        isRemoved: false,
        ...(q.category ? { category: q.category } : {}),
        ...(q.q ? { OR: [{ name: { contains: q.q, mode: "insensitive" } }, { description: { contains: q.q, mode: "insensitive" } }] } : {}),
      },
      select: cardSelect,
      orderBy: [{ isPartnered: "desc" }, { memberCount: "desc" }],
      take: q.limit,
    });
    return {
      servers: servers.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        iconUrl: s.iconUrl,
        bannerUrl: s.bannerUrl,
        category: s.category,
        memberCount: s.memberCount,
        tag: s.tag,
        tagBadge: s.tagBadge,
        badges: deriveBadges(s),
      })),
    };
  });

  // Preview a server before joining.
  app.get("/discovery/:id", async (req) => {
    const { id } = req.params as { id: string };
    const s = await prisma.server.findUnique({ where: { id }, select: cardSelect });
    if (!s || s.visibility === "PRIVATE") throw Errors.notFound("Server not found");
    const member = await prisma.serverMember.findUnique({
      where: { serverId_userId: { serverId: id, userId: userId(req) } },
      select: { id: true },
    });
    return {
      server: {
        id: s.id,
        name: s.name,
        description: s.description,
        iconUrl: s.iconUrl,
        bannerUrl: s.bannerUrl,
        category: s.category,
        memberCount: s.memberCount,
        badges: deriveBadges(s),
        isMember: !!member,
      },
    };
  });

  // Join a public/community/discoverable server directly (no invite needed).
  app.post("/discovery/:id/join", async (req, reply) => {
    const { id } = req.params as { id: string };
    const uid = userId(req);
    const server = await prisma.server.findUnique({ where: { id }, select: { visibility: true } });
    if (!server || server.visibility === "PRIVATE") throw Errors.notFound("Server not found");

    const banned = await prisma.ban.findUnique({
      where: { serverId_userId: { serverId: id, userId: uid } },
      select: { id: true },
    });
    if (banned) throw Errors.forbidden("You are banned from this server");

    const existing = await prisma.serverMember.findUnique({
      where: { serverId_userId: { serverId: id, userId: uid } },
      select: { id: true },
    });
    if (existing) return reply.send({ serverId: id, alreadyMember: true });

    await prisma.$transaction([
      prisma.serverMember.create({ data: { serverId: id, userId: uid } }),
      prisma.server.update({ where: { id }, data: { memberCount: { increment: 1 } } }),
    ]);
    return reply.code(201).send({ serverId: id, alreadyMember: false });
  });
}
