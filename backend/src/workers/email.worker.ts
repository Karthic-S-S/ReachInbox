import { Worker } from "bullmq";
import { env } from "../config/env.js";
import { redisConnection } from "../config/redis.js";
import { EMAIL_QUEUE_NAME, emailQueue, type TestEmailJobData } from "../queues/email.queue.js";

const worker = new Worker<TestEmailJobData>(
  EMAIL_QUEUE_NAME,
  async (job) => {
    console.info({
      event: "email.test.processed",
      jobId: job.id,
      message: job.data.message,
    });
  },
  {
    connection: redisConnection,
    concurrency: env.WORKER_CONCURRENCY,
  },
);

worker.on("completed", (job) => {
  console.info({ event: "email.job.completed", jobId: job.id, name: job.name });
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
