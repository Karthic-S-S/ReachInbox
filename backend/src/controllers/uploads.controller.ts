import type { Request, Response } from "express";
import { z } from "zod";

const emailSchema = z.string().trim().email();
const headerValues = new Set(["email", "email address", "recipient", "recipients"]);

function parseRecipients(source: string) {
  const recipients = new Set<string>();
  const invalid = new Set<string>();
  const tokens = source.split(/[\r\n,;\t]+/).map((value) => value.trim().replace(/^['\"]|['\"]$/g, ""));
  for (const token of tokens) {
    if (!token || headerValues.has(token.toLowerCase())) continue;
    const parsed = emailSchema.safeParse(token);
    if (parsed.success) recipients.add(parsed.data.toLowerCase());
    else invalid.add(token.slice(0, 255));
  }
  return { recipients: [...recipients], count: recipients.size, invalid: [...invalid] };
}

export function uploadRecipients(request: Request, response: Response) {
  if (!request.file) {
    response.status(400).json({ error: { code: "UPLOAD_REQUIRED", message: "A CSV or text recipient file is required." } });
    return;
  }
  const isSupported = request.file.mimetype === "text/csv" || request.file.mimetype === "text/plain" || request.file.mimetype === "application/csv" || /\.(csv|txt)$/i.test(request.file.originalname);
  if (!isSupported) {
    response.status(400).json({ error: { code: "UNSUPPORTED_FILE_TYPE", message: "Upload a CSV or plain-text recipient file." } });
    return;
  }
  response.json(parseRecipients(request.file.buffer.toString("utf8")));
}
