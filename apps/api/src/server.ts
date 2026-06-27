import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import { ZodError } from "zod";
import { env } from "./env.js";
import { ApiError } from "./errors.js";
import { createGateway, type AppIO } from "./realtime.js";
import { authRoutes } from "./routes/auth.js";
import { serverRoutes } from "./routes/servers.js";
import { channelRoutes } from "./routes/channels.js";
import { messageRoutes } from "./routes/messages.js";
import { inviteRoutes } from "./routes/invites.js";
import { friendRoutes } from "./routes/friends.js";
import { dmRoutes } from "./routes/dms.js";
import { roleRoutes } from "./routes/roles.js";
import { moderationRoutes } from "./routes/moderation.js";
import { discoveryRoutes } from "./routes/discovery.js";
import { badgeRoutes } from "./routes/badges.js";
import { adminRoutes } from "./routes/admin.js";
import { reportRoutes } from "./routes/reports.js";
import { webhookRoutes } from "./routes/webhooks.js";
import { developerRoutes } from "./routes/developer.js";

declare module "fastify" {
  interface FastifyInstance {
    io: AppIO;
  }
}

export async function buildServer() {
  const app = Fastify({
    logger: env.NODE_ENV === "development" ? { transport: { target: "pino-pretty" } } : true,
  });

  await app.register(cors, { origin: env.WEB_ORIGIN, credentials: true });
  await app.register(cookie);
  await app.register(rateLimit, { max: 300, timeWindow: "1 minute" });

  // Socket.IO shares Fastify's underlying HTTP server.
  const io = createGateway(app.server);
  app.decorate("io", io);

  // Unified error shape.
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({
        error: { code: "VALIDATION", message: "Invalid input", fields: err.flatten().fieldErrors },
      });
    }
    if (err instanceof ApiError) {
      return reply.code(err.statusCode).send({ error: { code: err.code, message: err.message } });
    }
    if ((err as { statusCode?: number }).statusCode === 429) {
      return reply.code(429).send({ error: { code: "RATE_LIMITED", message: "Too many requests" } });
    }
    app.log.error(err);
    return reply.code(500).send({ error: { code: "INTERNAL", message: "Something went wrong" } });
  });

  app.get("/health", async () => ({ ok: true, service: "solarcord-api" }));

  await app.register(authRoutes);
  await app.register(serverRoutes);
  await app.register(channelRoutes);
  await app.register(messageRoutes);
  await app.register(inviteRoutes);
  await app.register(friendRoutes);
  await app.register(dmRoutes);
  await app.register(roleRoutes);
  await app.register(moderationRoutes);
  await app.register(discoveryRoutes);
  await app.register(badgeRoutes);
  await app.register(adminRoutes);
  await app.register(reportRoutes);
  await app.register(webhookRoutes);
  await app.register(developerRoutes);

  return app;
}
