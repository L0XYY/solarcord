import type { FastifyInstance } from "fastify";
import argon2 from "argon2";
import { scryptSync, timingSafeEqual } from "node:crypto";
import { prisma } from "@solarcord/db";
import { signupSchema, loginSchema, DEFAULT_EVERYONE_PERMISSIONS } from "@solarcord/shared";
import { Errors } from "../errors.js";
import { requireAuth, userId } from "../auth.js";
import { toSelfUser } from "../dto.js";
import {
  signAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  REFRESH_COOKIE,
} from "../tokens.js";
import { env } from "../env.js";

// In production the web and API usually live on different domains, so the refresh
// cookie must be SameSite=None; Secure to be sent on cross-site fetches.
const isProd = env.NODE_ENV === "production";
const cookieOpts = {
  httpOnly: true,
  secure: isProd,
  sameSite: (isProd ? "none" : "lax") as "none" | "lax",
  path: "/auth",
  maxAge: env.REFRESH_TOKEN_TTL_DAYS * 86_400,
};

// Verify a password against an Argon2 hash, or a scrypt hash (used by the seed
// script, which has no native deps). Lets seeded accounts log in.
async function verifyPassword(hash: string, password: string): Promise<boolean> {
  if (hash.startsWith("scrypt$")) {
    const [, saltHex, keyHex] = hash.split("$");
    if (!saltHex || !keyHex) return false;
    const expected = Buffer.from(keyHex, "hex");
    const derived = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  }
  return argon2.verify(hash, password).catch(() => false);
}

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/signup", async (req, reply) => {
    const body = signupSchema.parse(req.body);

    const clash = await prisma.user.findFirst({
      where: { OR: [{ email: body.email.toLowerCase() }, { username: body.username }] },
      select: { email: true },
    });
    if (clash) throw Errors.conflict("Email or username already in use");

    const passwordHash = await argon2.hash(body.password, { type: argon2.argon2id });
    const user = await prisma.user.create({
      data: {
        email: body.email.toLowerCase(),
        username: body.username,
        displayName: body.displayName ?? body.username,
        passwordHash,
      },
    });

    const refresh = await issueRefreshToken(user.id, { ip: req.ip, userAgent: req.headers["user-agent"] });
    reply.setCookie(REFRESH_COOKIE, refresh.raw, cookieOpts);
    return reply.code(201).send({ user: toSelfUser(user), accessToken: signAccessToken(user.id) });
  });

  app.post("/auth/login", async (req, reply) => {
    const body = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    // Constant-ish work whether or not the user exists.
    const ok = user ? await verifyPassword(user.passwordHash, body.password) : false;
    if (!user || !ok) throw Errors.unauthorized("Incorrect email or password");
    if (user.isSuspended) throw Errors.forbidden("This account is suspended");

    const refresh = await issueRefreshToken(user.id, { ip: req.ip, userAgent: req.headers["user-agent"] });
    reply.setCookie(REFRESH_COOKIE, refresh.raw, cookieOpts);
    return reply.send({ user: toSelfUser(user), accessToken: signAccessToken(user.id) });
  });

  app.post("/auth/refresh", async (req, reply) => {
    const raw = req.cookies[REFRESH_COOKIE];
    if (!raw) throw Errors.unauthorized("No refresh token");
    const rotated = await rotateRefreshToken(raw, { ip: req.ip, userAgent: req.headers["user-agent"] });
    if (!rotated) {
      reply.clearCookie(REFRESH_COOKIE, { path: "/auth" });
      throw Errors.unauthorized("Refresh token invalid or expired");
    }
    reply.setCookie(REFRESH_COOKIE, rotated.raw, cookieOpts);
    return reply.send({ accessToken: signAccessToken(rotated.userId) });
  });

  app.post("/auth/logout", { preHandler: requireAuth }, async (req, reply) => {
    const raw = req.cookies[REFRESH_COOKIE];
    if (raw) await revokeRefreshToken(raw);
    reply.clearCookie(REFRESH_COOKIE, { path: "/auth" });
    return reply.code(204).send();
  });

  app.get("/auth/me", { preHandler: requireAuth }, async (req) => {
    const user = await prisma.user.findUnique({ where: { id: userId(req) } });
    if (!user) throw Errors.unauthorized();
    return { user: toSelfUser(user) };
  });
}

// Re-export so the servers module can use the same default perms constant.
export { DEFAULT_EVERYONE_PERMISSIONS };
