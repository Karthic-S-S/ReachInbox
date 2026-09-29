import { z } from "zod";

export const scheduledEmailRecoveryJobSchema = z.object({
  emailId: z.string().uuid(),
  processingStartedAt: z.string().datetime({ offset: true }),
  checkNumber: z.coerce.number().int().min(0).default(0),
});

export type ScheduledEmailRecoveryJobData = z.infer<typeof scheduledEmailRecoveryJobSchema>;
