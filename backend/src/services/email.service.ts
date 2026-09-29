import nodemailer from "nodemailer";
import { env } from "../config/env.js";

export type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
};

export type EmailDeliveryResult = {
  messageId: string;
  accepted: string[];
  rejected: string[];
  previewUrl?: string;
};

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASSWORD,
  },
});

export async function sendEmail(input: SendEmailInput): Promise<EmailDeliveryResult> {
  const info = await transporter.sendMail({
    from: env.SMTP_FROM,
    to: input.to,
    subject: input.subject,
    text: input.text,
  });
  const previewUrl = nodemailer.getTestMessageUrl(info);

  return {
    messageId: info.messageId,
    accepted: info.accepted.map(String),
    rejected: info.rejected.map(String),
    ...(previewUrl ? { previewUrl } : {}),
  };
}
