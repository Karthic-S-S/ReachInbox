import { z } from "zod";

export const scheduleEmailsSchema = z
  .object({
    senderId: z.string().uuid(),
    subject: z.string().trim().min(1).max(998),
    body: z.string().trim().min(1).max(1_000_000),
    recipients: z.array(z.string().trim().email()).min(1).max(1_000),
    startTime: z
      .string()
      .datetime({ offset: true })
      .transform((value) => new Date(value))
      .refine((value) => value.getTime() > Date.now(), "startTime must be in the future."),
    delayBetweenEmailsMs: z.coerce.number().int().min(0).max(2_147_483_647).default(0),
  })
  .superRefine((value, context) => {
    const recipients = new Set<string>();

    value.recipients.forEach((recipient, index) => {
      const normalizedRecipient = recipient.toLowerCase();
      if (recipients.has(normalizedRecipient)) {
        context.addIssue({
          code: "custom",
          message: "Each recipient may only appear once.",
          path: ["recipients", index],
        });
      }
      recipients.add(normalizedRecipient);
    });
  });

export type ScheduleEmailsInput = z.infer<typeof scheduleEmailsSchema>;

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
