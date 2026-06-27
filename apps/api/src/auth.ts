import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "@solarcord/db";
import { verifyAccessToken } from "./tokens.js";
import { Errors } from "./errors.js";

// Augment Fastify with the authenticated user id.
declare module "fastify" {
  interface FastifyRequest {
    userId?: string;
    isBot?: boolean;
  }
}

/**
 * preHandler that requires authentication. Accepts either:
 *  - "Authorization: Bearer <jwt>" (a logged-in user)
 *  - "Authorization: Bot <token>"  (a bot application)
 */
export async function requireAuth(req: FastifyRequest, _reply: FastifyReply) {
  const header = req.headers.authorization;

  if (header?.startsWith("Bot ")) {
    const token = header.slice(4).trim();
    const appRow = await prisma.botApplication.findUnique({ where: { token }, select: { botUserId: true } });
    if (!appRow) throw Errors.unauthorized("Invalid bot token");
    req.userId = appRow.botUserId;
    req.isBot = true;
    return;
  }

  if (!header?.startsWith("Bearer ")) throw Errors.unauthorized();
  const token = header.slice(7);
  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.sub;
    req.isBot = false;
  } catch {
    throw Errors.unauthorized("Invalid or expired token");
  }
}

/** Read the authenticated user id, throwing if the route forgot requireAuth. */
export function userId(req: FastifyRequest): string {
  if (!req.userId) throw Errors.unauthorized();
  return req.userId;
}
