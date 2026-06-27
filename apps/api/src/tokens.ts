import jwt from "jsonwebtoken";
import { randomBytes, createHash } from "node:crypto";
import { prisma } from "@solarcord/db";
import { env } from "./env.js";

export interface AccessPayload {
  sub: string; // userId
}

export function signAccessToken(userId: string): string {
  return jwt.sign({ sub: userId } satisfies AccessPayload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL,
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): AccessPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessPayload;
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** Issue a refresh token: random opaque string to the client, only its hash stored. */
export async function issueRefreshToken(userId: string, meta: { ip?: string; userAgent?: string }) {
  const raw = randomBytes(48).toString("hex");
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000);
  await prisma.refreshToken.create({
    data: { userId, tokenHash: sha256(raw), expiresAt, ip: meta.ip, userAgent: meta.userAgent },
  });
  return { raw, expiresAt };
}

/** Validate + rotate. Returns the userId and a fresh raw token, or null if invalid. */
export async function rotateRefreshToken(raw: string, meta: { ip?: string; userAgent?: string }) {
  const existing = await prisma.refreshToken.findUnique({ where: { tokenHash: sha256(raw) } });
  if (!existing || existing.revokedAt || existing.expiresAt < new Date()) return null;

  await prisma.refreshToken.update({
    where: { id: existing.id },
    data: { revokedAt: new Date() },
  });
  const next = await issueRefreshToken(existing.userId, meta);
  return { userId: existing.userId, raw: next.raw, expiresAt: next.expiresAt };
}

export async function revokeRefreshToken(raw: string) {
  await prisma.refreshToken
    .updateMany({ where: { tokenHash: sha256(raw) }, data: { revokedAt: new Date() } })
    .catch(() => {});
}

export const REFRESH_COOKIE = "sc_refresh";
