import { Redis } from "ioredis";
import { env } from "./env.js";

export const rateLimitRedis = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  maxRetriesPerRequest: null,
});
