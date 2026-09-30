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
  MIN_DELAY_BETWEEN_EMAILS_MS: z.coerce.number().int().min(0).max(3_600_000).default(2_000),
  MAX_EMAILS_PER_HOUR: z.coerce.number().int().min(1).max(1_000_000).default(200),
  BULL_BOARD_ENABLED: z.stringbool().default(false),
  ELASTICSEARCH_URL: z.string().url().default("http://localhost:9200"),
  ELASTICSEARCH_INDEX: z.string().trim().min(1).max(255).regex(/^[a-z0-9][a-z0-9_-]*$/).default("emails"),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535),
  SMTP_USER: z.string().min(1),
  SMTP_PASSWORD: z.string().min(1),
  SMTP_FROM: z.string().min(1),
  FRONTEND_URL: z.string().url().default("http://localhost:3001"),
  AUTH_ENABLED: z.stringbool().default(true),
  AUTH_COOKIE_NAME: z.string().regex(/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/).default("reachinbox_session"),
  AUTH_SESSION_SECRET: z.string().min(32).optional(),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_CALLBACK_URL: z.string().url().optional(),
}).superRefine((value, context) => {
  if (!value.AUTH_ENABLED) return;
  for (const key of ["AUTH_SESSION_SECRET", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_CALLBACK_URL"] as const) {
    if (!value[key]) context.addIssue({ code: "custom", path: [key], message: `${key} is required when AUTH_ENABLED=true.` });
  }
});

export const env = environmentSchema.parse(process.env);
