import { buildServer } from "./server.js";
import { env } from "./env.js";

async function main() {
  const app = await buildServer();
  await app.listen({ port: env.API_PORT, host: env.API_HOST });
  app.log.info(`SolarCord API ready on http://localhost:${env.API_PORT}`);
}

main().catch((err) => {
  console.error("Failed to start API:", err);
  process.exit(1);
});
