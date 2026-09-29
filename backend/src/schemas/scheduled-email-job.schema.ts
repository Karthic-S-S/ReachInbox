import { z } from "zod";

export const scheduledEmailJobSchema = z.object({
  emailId: z.string().uuid(),
});

export type ScheduledEmailJobData = z.infer<typeof scheduledEmailJobSchema>;
