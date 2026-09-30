import { SenderStatus } from "../generated/prisma/client.js";
import { z } from "zod";

const senderFields = {
  email: z.string().trim().email().max(255).transform((value) => value.toLowerCase()),
  displayName: z.string().trim().min(1).max(255).nullable().optional(),
  status: z.nativeEnum(SenderStatus).optional(),
  hourlySendLimit: z.coerce.number().int().min(1).max(1_000_000).nullable().optional(),
};

export const createSenderSchema = z.object(senderFields);

export const updateSenderSchema = z.object(senderFields).partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one sender field must be supplied.",
);
