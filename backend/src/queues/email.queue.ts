import { Queue } from "bullmq";
import { redisConnection } from "../config/redis.js";

export const EMAIL_QUEUE_NAME = "emailQueue";
export const TEST_EMAIL_JOB_NAME = "email.test";

export type TestEmailJobData = {
  message: string;
};

export const emailQueue = new Queue<TestEmailJobData>(EMAIL_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: { age: 86_400 },
    removeOnFail: { age: 604_800 },
  },
});

emailQueue.on("error", (error) => {
  console.error({ event: "queue.error", queue: EMAIL_QUEUE_NAME, error });
});
