import { Redis } from "ioredis";
import { env } from "./env.js";

// One shared client for commands, plus dedicated pub/sub pair for the Socket.IO adapter.
export const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: false });
export const redisPub = redis.duplicate();
export const redisSub = redis.duplicate();

for (const [name, client] of [
  ["redis", redis],
  ["redis:pub", redisPub],
  ["redis:sub", redisSub],
] as const) {
  client.on("error", (e) => console.error(`[${name}]`, e.message));
}
