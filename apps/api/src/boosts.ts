import { prisma } from "@solarcord/db";
import { boostLevelFor } from "@solarcord/shared";

const DAY = 24 * 60 * 60 * 1000;
const DURATION_MS: Record<string, number | null> = {
  "1w": 7 * DAY,
  "1m": 30 * DAY,
  "3m": 90 * DAY,
  "12m": 365 * DAY,
  permanent: null,
};

export function durationToExpiry(duration: string): Date | null {
  const ms = DURATION_MS[duration];
  return ms == null ? null : new Date(Date.now() + ms);
}

// Drop any expired boosts, recount the active ones, and sync the cached
// boostCount/boostLevel on the server. Returns the live count + level.
export async function recomputeServerBoosts(serverId: string): Promise<{ boostCount: number; boostLevel: number }> {
  await prisma.serverBoost.deleteMany({ where: { serverId, expiresAt: { lt: new Date() } } });
  const boostCount = await prisma.serverBoost.count({ where: { serverId } });
  const boostLevel = boostLevelFor(boostCount);
  await prisma.server.update({ where: { id: serverId }, data: { boostCount, boostLevel } });
  return { boostCount, boostLevel };
}
