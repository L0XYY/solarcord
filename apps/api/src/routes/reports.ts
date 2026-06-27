import type { FastifyInstance } from "fastify";
import { prisma } from "@solarcord/db";
import { createReportSchema } from "@solarcord/shared";
import { Errors } from "../errors.js";
import { requireAuth, userId } from "../auth.js";

export async function reportRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  // File a report against a message, user, or server.
  app.post("/reports", async (req, reply) => {
    const uid = userId(req);
    const body = createReportSchema.parse(req.body);

    // De-dupe: one open report per reporter+target.
    const existing = await prisma.report.findFirst({
      where: { reporterId: uid, targetType: body.targetType, targetId: body.targetId, status: { in: ["OPEN", "REVIEWING"] } },
      select: { id: true },
    });
    if (existing) return reply.code(200).send({ ok: true, deduped: true });

    await prisma.report.create({
      data: { reporterId: uid, targetType: body.targetType, targetId: body.targetId, reason: body.reason },
    });
    return reply.code(201).send({ ok: true });
  });
}
