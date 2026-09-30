import { z } from "zod";
import { EmailStatus } from "../generated/prisma/client.js";

export const searchEmailsSchema = z.object({
  q: z.string().trim().min(1).max(500).optional(),
  status: z.nativeEnum(EmailStatus).optional(),
  senderId: z.string().uuid().optional(),
  campaignId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
