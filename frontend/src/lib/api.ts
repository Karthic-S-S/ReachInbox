export type MailboxKind = "scheduled" | "sent";

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}
export interface AuthSession {
  token: string;
  user: UserAccount;
}
export interface MailSummary {
  id: string;
  recipientName: string;
  recipientEmail: string;
  subject: string;
  preview: string;
  status: MailboxKind;
  scheduledAt?: string;
  sentAt?: string;
  starred: boolean;
}
export interface Attachment {
  id: string;
  name: string;
  size: number;
  contentType: string;
  url: string;
}
export interface MailMessage extends MailSummary {
  senderName: string;
  senderEmail: string;
  html: string;
  attachments: Attachment[];
}
export interface MailboxResponse {
  items: MailSummary[];
  total: number;
}
export interface ComposePayload {
  recipients: string[];
  subject: string;
  html: string;
  delaySeconds: number;
  hourlyLimit: number;
  attachmentIds: string[];
  scheduledAt?: string;
}

const API_BASE_URL = (import.meta.env["VITE_API_BASE_URL"] ?? "").replace(/\/$/, "");
let accessToken: string | undefined;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function setAccessToken(token?: string) {
  accessToken = token;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!(init?.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  if (!response.ok) {
    const body = (await response.json().catch(() => undefined)) as { message?: string } | undefined;
    throw new ApiError(response.status, body?.message ?? "The request could not be completed.");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  login: (email: string, password: string) =>
    request<AuthSession>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  googleLoginUrl: () => `${API_BASE_URL}/api/auth/google`,
  listMail: (mailbox: MailboxKind, signal?: AbortSignal) =>
    request<MailboxResponse>(`/api/mail?mailbox=${mailbox}`, signal ? { signal } : undefined),
  getMail: (id: string, signal?: AbortSignal) =>
    request<MailMessage>(`/api/mail/${encodeURIComponent(id)}`, signal ? { signal } : undefined),
  uploadAttachment: (file: File) => {
    const body = new FormData();
    body.append("file", file);
    return request<Attachment>("/api/attachments", { method: "POST", body });
  },
  uploadRecipients: (file: File) => {
    const body = new FormData();
    body.append("file", file);
    return request<{ recipients: string[] }>("/api/recipients/import", { method: "POST", body });
  },
  sendMail: (payload: ComposePayload) =>
    request<MailMessage>("/api/mail/send", { method: "POST", body: JSON.stringify(payload) }),
  scheduleMail: (payload: ComposePayload) =>
    request<MailMessage>("/api/mail/schedule", { method: "POST", body: JSON.stringify(payload) }),
};
