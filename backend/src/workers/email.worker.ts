import { Worker } from "bullmq";
import { env } from "../config/env.js";
import { redisConnection } from "../config/redis.js";
import { EMAIL_QUEUE_NAME, emailQueue } from "../queues/email.queue.js";
import { testEmailJobSchema, type TestEmailJobData } from "../schemas/test-email-job.schema.js";
import { sendEmail, type EmailDeliveryResult } from "../services/email.service.js";

const worker = new Worker<TestEmailJobData, EmailDeliveryResult>(
  EMAIL_QUEUE_NAME,
  async (job) => {
    const result = testEmailJobSchema.safeParse(job.data);
    if (!result.success) {
      throw new Error("The queued test email payload is invalid.");
    }

    const delivery = await sendEmail(result.data);
    console.info({
      event: "email.test.sent",
      jobId: job.id,
      messageId: delivery.messageId,
      accepted: delivery.accepted,
      rejected: delivery.rejected,
      previewUrl: delivery.previewUrl,
    });
    return delivery;
  },
  {
    connection: redisConnection,
    concurrency: env.WORKER_CONCURRENCY,
  },
);

worker.on("completed", (job) => {
  console.info({
    event: "email.job.completed",
    jobId: job.id,
    name: job.name,
    previewUrl: job.returnvalue.previewUrl,
  });
});

worker.on("failed", (job, error) => {
  console.error({ event: "email.job.failed", jobId: job?.id, name: job?.name, error });
});

worker.on("error", (error) => {
  console.error({ event: "worker.error", queue: EMAIL_QUEUE_NAME, error });
});

async function shutdown(signal: string) {
  console.info({ event: "worker.shutdown", signal });
  await worker.close();
  await emailQueue.close();
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
