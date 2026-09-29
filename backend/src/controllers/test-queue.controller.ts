import type { Request, Response } from "express";
import { z } from "zod";
import { emailQueue, TEST_EMAIL_JOB_NAME } from "../queues/email.queue.js";

const testQueueJobSchema = z.object({
  message: z.string().trim().min(1).max(500).default("test"),
  delayMs: z.coerce.number().int().min(0).max(604_800_000).default(0),
});

export async function enqueueTestJob(request: Request, response: Response) {
  const result = testQueueJobSchema.safeParse(request.body);
  if (!result.success) {
    response.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "The test queue payload is invalid.",
      },
    });
    return;
  }

  const payload = result.data;
  const job = await emailQueue.add(TEST_EMAIL_JOB_NAME, { message: payload.message }, { delay: payload.delayMs });

  response.status(202).json({
    jobId: job.id,
    name: job.name,
    delayMs: payload.delayMs,
  });
}
