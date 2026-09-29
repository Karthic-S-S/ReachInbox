import { z } from "zod";

export const testEmailJobSchema = z.object({
  to: z.string().trim().email(),
  subject: z.string().trim().min(1).max(998),
  text: z.string().trim().min(1).max(10_000),
});

export type TestEmailJobData = z.infer<typeof testEmailJobSchema>;
