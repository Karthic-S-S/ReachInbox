import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { EmailStatus, SenderStatus } from "../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import { enqueueScheduledEmails } from "../queues/email.queue.js";
import { paginationSchema, scheduleEmailsSchema } from "../schemas/schedule-email.schema.js";

type HttpError = Error & { status: number };

function requestError(status: number, message: string): HttpError {
  const error = new Error(message) as HttpError;
  error.status = status;
  return error;
}

export async function scheduleEmails(request: Request, response: Response) {
  const parsedInput = scheduleEmailsSchema.safeParse(request.body);
  if (!parsedInput.success) {
    response.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "The email scheduling payload is invalid.",
      },
    });
    return;
  }

  const input = parsedInput.data;
  const sender = await prisma.sender.findFirst({
    where: { id: input.senderId, status: SenderStatus.ACTIVE },
    select: { id: true, userId: true },
  });
  if (!sender) {
    throw requestError(404, "An active sender with the supplied senderId was not found.");
  }

  const campaignId = randomUUID();
  const emailsToSchedule = input.recipients.map((recipientEmail, index) => ({
    id: randomUUID(),
    recipientEmail,
    scheduledAt: new Date(input.startTime.getTime() + index * input.delayBetweenEmailsMs),
  }));

  const campaign = await prisma.$transaction((transaction) =>
    transaction.campaign.create({
      data: {
        id: campaignId,
        userId: sender.userId,
        senderId: sender.id,
        name: input.subject.slice(0, 255),
        status: "SCHEDULED",
        scheduledAt: input.startTime,
        emails: {
          create: emailsToSchedule.map((email) => ({
            id: email.id,
            userId: sender.userId,
            senderId: sender.id,
            recipientEmail: email.recipientEmail,
            subject: input.subject,
            htmlBody: input.body,
            status: "SCHEDULED",
            scheduledAt: email.scheduledAt,
            workerJobId: email.id,
          })),
        },
      },
      include: {
        emails: {
          select: { id: true, recipientEmail: true, scheduledAt: true },
          orderBy: { scheduledAt: "asc" },
        },
      },
    }),
  );

  try {
    await enqueueScheduledEmails(campaign.emails.map((email) => ({ id: email.id, scheduledAt: email.scheduledAt! })));
  } catch (error) {
    await prisma.email.updateMany({
      where: { id: { in: campaign.emails.map((email) => email.id) }, status: EmailStatus.SCHEDULED },
      data: { status: EmailStatus.FAILED, failureReason: "The email could not be queued for delivery." },
    });
    throw error;
  }

  response.status(201).json({
    campaignId: campaign.id,
    scheduledCount: campaign.emails.length,
    emails: campaign.emails.map((email) => ({
      id: email.id,
      recipient: email.recipientEmail,
      scheduledAt: email.scheduledAt,
    })),
  });
}

export async function getScheduledEmails(request: Request, response: Response) {
  const pagination = paginationSchema.parse(request.query);
  const where = { status: { in: [EmailStatus.SCHEDULED, EmailStatus.PROCESSING] } };
  const [total, emails] = await prisma.$transaction([
    prisma.email.count({ where }),
    prisma.email.findMany({
      where,
      orderBy: { scheduledAt: "asc" },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
      select: emailSummarySelection,
    }),
  ]);

  response.json({ page: pagination.page, limit: pagination.limit, total, emails });
}

export async function getSentEmails(request: Request, response: Response) {
  const pagination = paginationSchema.parse(request.query);
  const where = { status: { in: [EmailStatus.SENT, EmailStatus.FAILED] } };
  const [total, emails] = await prisma.$transaction([
    prisma.email.count({ where }),
    prisma.email.findMany({
      where,
      orderBy: [{ sentAt: "desc" }, { updatedAt: "desc" }],
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
      select: emailSummarySelection,
    }),
  ]);

  response.json({ page: pagination.page, limit: pagination.limit, total, emails });
}

const emailSummarySelection = {
  id: true,
  recipientEmail: true,
  subject: true,
  scheduledAt: true,
  sentAt: true,
  status: true,
  campaignId: true,
  senderId: true,
} as const;
