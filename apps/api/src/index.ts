import { buildServer } from "./server.js";
import { env } from "./env.js";
import { prisma } from "@solarcord/db";

// Suspend accounts that never verified their email before the grace period ended.
async function sweepUnverified() {
  try {
    const { count } = await prisma.user.updateMany({
      where: { emailVerified: false, isSuspended: false, isStaff: false, emailDeadline: { lt: new Date() } },
      data: { isSuspended: true, standing: "SUSPENDED", standingReason: "Email was never verified within the grace period." },
    });
    if (count > 0) console.log(`[verify-sweep] closed ${count} unverified account(s)`);
  } catch (e) {
    console.error("[verify-sweep] failed", e);
  }
}

async function main() {
  const app = await buildServer();
  await app.listen({ port: env.API_PORT, host: env.API_HOST });
  app.log.info(`SolarCord API ready on http://localhost:${env.API_PORT}`);

  // Run once on boot, then hourly.
  void sweepUnverified();
  setInterval(() => void sweepUnverified(), 60 * 60 * 1000).unref();
}

main().catch((err) => {
  console.error("Failed to start API:", err);
  process.exit(1);
});
