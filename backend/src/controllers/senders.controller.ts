import type { Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import { createSenderSchema, updateSenderSchema } from "../schemas/sender.schema.js";

type HttpError = Error & { status: number };

const senderSelection = {
  id: true,
  email: true,
  displayName: true,
  status: true,
  hourlySendLimit: true,
  createdAt: true,
  updatedAt: true,
} as const;

function requestError(status: number, message: string): HttpError {
  const error = new Error(message) as HttpError;
  error.status = status;
  return error;
}

function senderId(request: Request) {
  return Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
}

function validationError(response: Response) {
  response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "The sender payload is invalid." } });
}

function isUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export async function listSenders(request: Request, response: Response) {
  const senders = await prisma.sender.findMany({
    where: { userId: request.authenticatedUser!.id },
    orderBy: [{ status: "asc" }, { displayName: "asc" }, { email: "asc" }],
    select: senderSelection,
  });
  response.json({ senders });
}

export async function createSender(request: Request, response: Response) {
  const parsed = createSenderSchema.safeParse(request.body);
  if (!parsed.success) return validationError(response);
  try {
    const sender = await prisma.sender.create({
      data: { ...parsed.data, userId: request.authenticatedUser!.id },
      select: senderSelection,
    });
    response.status(201).json({ sender });
  } catch (error) {
    if (isUniqueConstraintError(error)) throw requestError(409, "A sender with that email already exists.");
    throw error;
  }
}

export async function getSender(request: Request, response: Response) {
  const sender = await prisma.sender.findFirst({
    where: { id: senderId(request), userId: request.authenticatedUser!.id },
    select: senderSelection,
  });
  if (!sender) throw requestError(404, "The sender was not found.");
  response.json({ sender });
}

export async function updateSender(request: Request, response: Response) {
  const parsed = updateSenderSchema.safeParse(request.body);
  if (!parsed.success) return validationError(response);
  const existing = await prisma.sender.findFirst({ where: { id: senderId(request), userId: request.authenticatedUser!.id }, select: { id: true } });
  if (!existing) throw requestError(404, "The sender was not found.");
  try {
    const sender = await prisma.sender.update({ where: { id: existing.id }, data: parsed.data, select: senderSelection });
    response.json({ sender });
  } catch (error) {
    if (isUniqueConstraintError(error)) throw requestError(409, "A sender with that email already exists.");
    throw error;
  }
}

export async function deleteSender(request: Request, response: Response) {
  const existing = await prisma.sender.findFirst({
    where: { id: senderId(request), userId: request.authenticatedUser!.id },
    select: { id: true, _count: { select: { campaigns: true } } },
  });
  if (!existing) throw requestError(404, "The sender was not found.");
  if (existing._count.campaigns > 0) throw requestError(409, "The sender cannot be deleted while it is used by a campaign.");
  await prisma.sender.delete({ where: { id: existing.id } });
  response.status(204).send();
}
