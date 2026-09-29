import { Worker } from "bullmq";
import { EmailStatus } from "../generated/prisma/client.js";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { redisConnection } from "../config/redis.js";
import {
  EMAIL_QUEUE_NAME,
  SCHEDULED_EMAIL_JOB_NAME,
  TEST_EMAIL_JOB_NAME,
  emailQueue,
  type EmailQueueJobData,
} from "../queues/email.queue.js";
import { scheduledEmailJobSchema, type ScheduledEmailJobData } from "../schemas/scheduled-email-job.schema.js";
import { testEmailJobSchema, type TestEmailJobData } from "../schemas/test-email-job.schema.js";
import { sendEmail, type EmailDeliveryResult } from "../services/email.service.js";

type ScheduledEmailJobResult = {
  emailId: string;
  status: "SENT" | "SKIPPED";
  messageId?: string;
  previewUrl?: string;
};

type EmailJobResult = EmailDeliveryResult | ScheduledEmailJobResult;

async function processTestEmail(data: TestEmailJobData): Promise<EmailDeliveryResult> {
  const delivery = await sendEmail(data);
  console.info({
    event: "email.test.sent",
    messageId: delivery.messageId,
    accepted: delivery.accepted,
    rejected: delivery.rejected,
    previewUrl: delivery.previewUrl,
  });
  return delivery;
}

async function processScheduledEmail(data: ScheduledEmailJobData): Promise<ScheduledEmailJobResult> {
  const email = await prisma.email.findUnique({ where: { id: data.emailId } });
  if (!email) {
    throw new Error(`Scheduled email ${data.emailId} was not found.`);
  }

  if (email.status === EmailStatus.SENT || email.status === EmailStatus.FAILED) {
    return { emailId: email.id, status: "SKIPPED" };
  }

  const claim = await prisma.email.updateMany({
    where: { id: email.id, status: EmailStatus.SCHEDULED },
    data: { status: EmailStatus.PROCESSING, failureReason: null },
  });
  if (claim.count !== 1) {
    return { emailId: email.id, status: "SKIPPED" };
  }

  let delivery: EmailDeliveryResult;
  try {
    delivery = await sendEmail({
      to: email.recipientEmail,
      subject: email.subject,
      text: email.htmlBody,
    });
  } catch (error) {
    const failureReason = error instanceof Error ? error.message.slice(0, 4_000) : "Unknown SMTP delivery failure.";
    await prisma.email.updateMany({
      where: { id: email.id, status: EmailStatus.PROCESSING },
      data: { status: EmailStatus.FAILED, failureReason },
    });
    throw error;
  }

  await prisma.email.update({
    where: { id: email.id },
    data: {
      status: EmailStatus.SENT,
      sentAt: new Date(),
      providerMessageId: delivery.messageId,
      failureReason: null,
    },
  });

  console.info({
    event: "email.scheduled.sent",
    emailId: email.id,
    messageId: delivery.messageId,
    previewUrl: delivery.previewUrl,
  });
  return { emailId: email.id, status: "SENT", messageId: delivery.messageId, previewUrl: delivery.previewUrl };
}

const worker = new Worker<EmailQueueJobData, EmailJobResult>(
  EMAIL_QUEUE_NAME,
  async (job) => {
    if (job.name === TEST_EMAIL_JOB_NAME) {
      const result = testEmailJobSchema.safeParse(job.data);
      if (!result.success) throw new Error("The queued test email payload is invalid.");
      return processTestEmail(result.data);
    }

    if (job.name === SCHEDULED_EMAIL_JOB_NAME) {
      const result = scheduledEmailJobSchema.safeParse(job.data);
      if (!result.success) throw new Error("The queued scheduled email payload is invalid.");
      return processScheduledEmail(result.data);
    }

    throw new Error(`Unsupported email job type: ${job.name}`);
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
    result: job.returnvalue,
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
  await prisma.$disconnect();
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
