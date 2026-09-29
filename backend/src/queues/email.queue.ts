import { Queue } from "bullmq";
import { env } from "../config/env.js";
import { redisConnection } from "../config/redis.js";
import type { ScheduledEmailJobData } from "../schemas/scheduled-email-job.schema.js";
import type { ScheduledEmailRecoveryJobData } from "../schemas/scheduled-email-recovery-job.schema.js";
import type { TestEmailJobData } from "../schemas/test-email-job.schema.js";

export const EMAIL_QUEUE_NAME = "emailQueue";
export const TEST_EMAIL_JOB_NAME = "email.test";
export const SCHEDULED_EMAIL_JOB_NAME = "email.scheduled";
export const SCHEDULED_EMAIL_RECOVERY_JOB_NAME = "email.recover";

export type EmailQueueJobData = TestEmailJobData | ScheduledEmailJobData | ScheduledEmailRecoveryJobData;

export function getScheduledEmailJobId(emailId: string) {
  // BullMQ forbids colons in custom job IDs, so use a safe deterministic prefix.
  return `email-${emailId}`;
}

function getScheduledEmailRecoveryJobId(emailId: string, processingStartedAt: Date, checkNumber: number) {
  return `email-recovery-${emailId}-${processingStartedAt.getTime()}-${checkNumber}`;
}

export const emailQueue = new Queue<EmailQueueJobData>(EMAIL_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: { age: 86_400 },
    removeOnFail: { age: 604_800 },
  },
});

export async function enqueueScheduledEmails(emails: Array<{ id: string; scheduledAt: Date }>) {
  const now = Date.now();

  await emailQueue.addBulk(
    emails.map((email) => ({
      name: SCHEDULED_EMAIL_JOB_NAME,
      data: { emailId: email.id },
      opts: {
        jobId: getScheduledEmailJobId(email.id),
        delay: Math.max(0, email.scheduledAt.getTime() - now),
        attempts: env.EMAIL_JOB_ATTEMPTS,
        backoff: { type: "exponential", delay: env.EMAIL_JOB_BACKOFF_MS },
      },
    })),
  );
}

export async function enqueueProcessingRecovery(emailId: string, processingStartedAt: Date, checkNumber = 0) {
  await emailQueue.add(
    SCHEDULED_EMAIL_RECOVERY_JOB_NAME,
    { emailId, processingStartedAt: processingStartedAt.toISOString(), checkNumber },
    {
      jobId: getScheduledEmailRecoveryJobId(emailId, processingStartedAt, checkNumber),
      delay: env.PROCESSING_TIMEOUT_MS,
      attempts: 1,
    },
  );
}

emailQueue.on("error", (error) => {
  console.error({ event: "queue.error", queue: EMAIL_QUEUE_NAME, error });
});
