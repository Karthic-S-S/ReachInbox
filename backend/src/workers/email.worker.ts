import { DelayedError, Job, Worker } from "bullmq";
import { EmailStatus } from "../generated/prisma/client.js";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { redisConnection } from "../config/redis.js";
import {
  EMAIL_QUEUE_NAME,
  SCHEDULED_EMAIL_RECOVERY_JOB_NAME,
  SCHEDULED_EMAIL_JOB_NAME,
  TEST_EMAIL_JOB_NAME,
  enqueueProcessingRecovery,
  enqueueScheduledEmails,
  emailQueue,
  type EmailQueueJobData,
} from "../queues/email.queue.js";
import { scheduledEmailJobSchema, type ScheduledEmailJobData } from "../schemas/scheduled-email-job.schema.js";
import {
  scheduledEmailRecoveryJobSchema,
  type ScheduledEmailRecoveryJobData,
} from "../schemas/scheduled-email-recovery-job.schema.js";
import { testEmailJobSchema, type TestEmailJobData } from "../schemas/test-email-job.schema.js";
import { sendEmail, type EmailDeliveryResult } from "../services/email.service.js";
import { reserveEmailSendSlot } from "../services/email-rate-limiter.service.js";
import { rateLimitRedis } from "../config/rate-limit-redis.js";
import { closeElasticsearch, syncEmailSearchDocument } from "../services/email-search.service.js";
import { notifyRateLimitHit } from "../services/slack.service.js";

type ScheduledEmailJobResult = {
  emailId: string;
  status: "SENT" | "SKIPPED" | "RECOVERED" | "ACTIVE" | "THROTTLED";
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

function sanitizeFailureReason(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown email delivery failure.";
  return message.replace(/(password|pass|auth)\s*[:=]\s*\S+/gi, "$1=[redacted]").slice(0, 4_000);
}

async function persistAttemptFailure(emailId: string, attemptsMade: number, attempts: number, error: unknown) {
  const isFinalAttempt = attemptsMade + 1 >= attempts;

  await prisma.email.updateMany({
    where: { id: emailId, status: EmailStatus.PROCESSING },
    data: {
      status: isFinalAttempt ? EmailStatus.FAILED : EmailStatus.SCHEDULED,
      processingStartedAt: null,
      failureReason: sanitizeFailureReason(error),
    },
  });
  void syncEmailSearchDocument(emailId);
}

async function restoreThrottledEmail(emailId: string, processingStartedAt: Date, nextEligibleAt: Date) {
  const restored = await prisma.email.updateMany({
    where: { id: emailId, status: EmailStatus.PROCESSING, processingStartedAt },
    data: {
      status: EmailStatus.SCHEDULED,
      scheduledAt: nextEligibleAt,
      processingStartedAt: null,
    },
  });
  if (restored.count !== 1) {
    throw new Error(`Unable to safely reschedule throttled email ${emailId}.`);
  }
  void syncEmailSearchDocument(emailId);
}

async function processScheduledEmail(
  job: Job<EmailQueueJobData, EmailJobResult>,
  data: ScheduledEmailJobData,
  attemptsMade: number,
  attempts: number,
): Promise<ScheduledEmailJobResult> {
  const email = await prisma.email.findUnique({ where: { id: data.emailId } });
  if (!email) {
    throw new Error(`Scheduled email ${data.emailId} was not found.`);
  }

  if (email.status === EmailStatus.SENT || email.status === EmailStatus.FAILED) {
    return { emailId: email.id, status: "SKIPPED" };
  }

  const processingStartedAt = new Date();
  const claim = await prisma.email.updateMany({
    where: { id: email.id, status: EmailStatus.SCHEDULED },
    data: { status: EmailStatus.PROCESSING, processingStartedAt, failureReason: null },
  });
  if (claim.count !== 1) {
    return { emailId: email.id, status: "SKIPPED" };
  }
  void syncEmailSearchDocument(email.id);

  try {
    await enqueueProcessingRecovery(email.id, processingStartedAt);
  } catch (error) {
    await persistAttemptFailure(email.id, attemptsMade, attempts, error);
    throw error;
  }

  let rateLimitDecision;
  try {
    rateLimitDecision = await reserveEmailSendSlot();
  } catch (error) {
    await persistAttemptFailure(email.id, attemptsMade, attempts, error);
    throw error;
  }

  if (!rateLimitDecision.allowed) {
    await restoreThrottledEmail(email.id, processingStartedAt, rateLimitDecision.nextEligibleAt);
    if (rateLimitDecision.reason === "HOURLY_LIMIT") {
      await notifyRateLimitHit({
        userId: email.userId,
        senderId: email.senderId,
        hourlyLimit: env.MAX_EMAILS_PER_HOUR,
        nextEligibleAt: rateLimitDecision.nextEligibleAt,
      });
    }
    await job.moveToDelayed(rateLimitDecision.nextEligibleAt.getTime(), job.token);
    console.info({
      event: "email.rate_limited",
      emailId: email.id,
      reason: rateLimitDecision.reason,
      nextEligibleAt: rateLimitDecision.nextEligibleAt.toISOString(),
    });
    throw new DelayedError();
  }

  const sendStartedAt = new Date();
  let delivery: EmailDeliveryResult;
  try {
    delivery = await sendEmail({
      to: email.recipientEmail,
      subject: email.subject,
      text: email.htmlBody,
    });
  } catch (error) {
    await persistAttemptFailure(email.id, attemptsMade, attempts, error);
    throw error;
  }

  await prisma.email.update({
    where: { id: email.id },
    data: {
      status: EmailStatus.SENT,
      sentAt: new Date(),
      processingStartedAt: null,
      providerMessageId: delivery.messageId,
      failureReason: null,
    },
  });
  void syncEmailSearchDocument(email.id);

  console.info({
    event: "email.scheduled.sent",
    emailId: email.id,
    sendStartedAt: sendStartedAt.toISOString(),
    messageId: delivery.messageId,
    previewUrl: delivery.previewUrl,
  });
  return { emailId: email.id, status: "SENT", messageId: delivery.messageId, previewUrl: delivery.previewUrl };
}

async function processScheduledEmailRecovery(data: ScheduledEmailRecoveryJobData): Promise<ScheduledEmailJobResult> {
  const expectedProcessingStartedAt = new Date(data.processingStartedAt);
  const email = await prisma.email.findUnique({ where: { id: data.emailId } });
  if (!email || email.status !== EmailStatus.PROCESSING || !email.processingStartedAt) {
    return { emailId: data.emailId, status: "SKIPPED" };
  }

  if (email.processingStartedAt.getTime() !== expectedProcessingStartedAt.getTime()) {
    return { emailId: email.id, status: "SKIPPED" };
  }

  if (Date.now() - email.processingStartedAt.getTime() < env.PROCESSING_TIMEOUT_MS) {
    return { emailId: email.id, status: "SKIPPED" };
  }

  const originalJob = email.workerJobId ? await emailQueue.getJob(email.workerJobId) : undefined;
  if (originalJob && (await originalJob.getState()) === "active") {
    await enqueueProcessingRecovery(email.id, expectedProcessingStartedAt, data.checkNumber + 1);
    return { emailId: email.id, status: "ACTIVE" };
  }

  const recovered = await prisma.email.updateMany({
    where: {
      id: email.id,
      status: EmailStatus.PROCESSING,
      processingStartedAt: expectedProcessingStartedAt,
    },
    data: {
      status: EmailStatus.SCHEDULED,
      processingStartedAt: null,
      failureReason: "Processing lease expired before delivery was recorded.",
    },
  });
  if (recovered.count !== 1) {
    return { emailId: email.id, status: "SKIPPED" };
  }
  void syncEmailSearchDocument(email.id);

  if (originalJob) {
    const state = await originalJob.getState();
    if (state === "completed" || state === "failed") await originalJob.remove();
  }

  await enqueueScheduledEmails([{ id: email.id, scheduledAt: email.scheduledAt ?? new Date() }]);
  console.warn({ event: "email.scheduled.recovered", emailId: email.id });
  return { emailId: email.id, status: "RECOVERED" };
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
      return processScheduledEmail(job, result.data, job.attemptsMade, job.opts.attempts ?? 1);
    }

    if (job.name === SCHEDULED_EMAIL_RECOVERY_JOB_NAME) {
      const result = scheduledEmailRecoveryJobSchema.safeParse(job.data);
      if (!result.success) throw new Error("The queued scheduled email recovery payload is invalid.");
      return processScheduledEmailRecovery(result.data);
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

let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.info({ event: "worker.shutdown", signal });
  await worker.close();
  await emailQueue.close();
  await rateLimitRedis.quit();
  await closeElasticsearch();
  await prisma.$disconnect();
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
