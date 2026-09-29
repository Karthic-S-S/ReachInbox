import type { Request, Response } from "express";
import { prisma } from "../config/prisma.js";

export function getHealth(_request: Request, response: Response) {
  response.json({ status: "ok" });
}

export async function getDatabaseHealth(_request: Request, response: Response) {
  await prisma.$queryRaw`SELECT 1`;
  response.json({ status: "ok", database: "ok" });
}
