import { Queue } from "bullmq";
import { redisConnection } from "../config/redis.js";
import type { ScheduledEmailJobData } from "../schemas/scheduled-email-job.schema.js";
import type { TestEmailJobData } from "../schemas/test-email-job.schema.js";

export const EMAIL_QUEUE_NAME = "emailQueue";
export const TEST_EMAIL_JOB_NAME = "email.test";
export const SCHEDULED_EMAIL_JOB_NAME = "email.scheduled";

export type EmailQueueJobData = TestEmailJobData | ScheduledEmailJobData;

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
        jobId: email.id,
        delay: Math.max(0, email.scheduledAt.getTime() - now),
      },
    })),
  );
}

emailQueue.on("error", (error) => {
  console.error({ event: "queue.error", queue: EMAIL_QUEUE_NAME, error });
});
