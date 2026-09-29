import "dotenv/config";
import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().url(),
  SHADOW_DATABASE_URL: z.string().url(),
  REDIS_HOST: z.string().min(1).default("localhost"),
  REDIS_PORT: z.coerce.number().int().min(1).max(65535).default(6380),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(100).default(5),
  EMAIL_JOB_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(3),
  EMAIL_JOB_BACKOFF_MS: z.coerce.number().int().min(0).max(3_600_000).default(5_000),
  PROCESSING_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(86_400_000).default(300_000),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535),
  SMTP_USER: z.string().min(1),
  SMTP_PASSWORD: z.string().min(1),
  SMTP_FROM: z.string().min(1),
});

export const env = environmentSchema.parse(process.env);
