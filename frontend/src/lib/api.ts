export type MailboxKind = "scheduled" | "sent";
export type EmailStatus = "DRAFT" | "SCHEDULED" | "PROCESSING" | "SENT" | "FAILED" | "CANCELLED";

export interface UserAccount {
  id: string;
  name: string | null;
  email: string;
  avatar: string | null;
}
export interface SlackStatus {
  connected: boolean;
  workspace?: { id: string; name: string | null };
}
export interface Sender {
  id: string;
  email: string;
  displayName: string | null;
  status: "ACTIVE" | "DISABLED";
  hourlySendLimit: number | null;
  createdAt: string;
  updatedAt: string;
}
export interface Email {
  id: string;
  recipientEmail: string;
  subject: string;
  status: EmailStatus;
  scheduledAt: string | null;
  sentAt: string | null;
  campaignId: string;
  senderId: string;
}
export interface EmailDetail extends Email {
  htmlBody: string;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface MailboxResponse {
  page: number;
  limit: number;
  total: number;
  emails: Email[];
}
export interface SearchResult {
  data: Email[];
  pagination: { page: number; limit: number; total: number };
}
export interface RecipientUploadResult {
  recipients: string[];
  count: number;
  invalid: string[];
}
export interface ScheduleEmailsPayload {
  senderId: string;
  recipients: string[];
  subject: string;
  body: string;
  startTime: string;
  delayBetweenEmailsMs: number;
}
export interface UpdateSenderPayload {
  hourlySendLimit?: number | null;
}
export interface ScheduleEmailsResponse {
  campaignId: string;
  scheduledCount: number;
  emails: Array<{ id: string; recipient: string; scheduledAt: string }>;
}
export interface ApiErrorBody {
  error: { code: string; message: string };
}

// TanStack Start's Nitro handler owns unmatched paths during local development,
// so the API must use the backend origin rather than rely on Vite's dev proxy.
const API_BASE_URL = (
  import.meta.env["VITE_API_BASE_URL"] ?? (import.meta.env.DEV ? "http://localhost:3000" : "")
).replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!(init?.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => undefined)) as ApiErrorBody | undefined;
    throw new ApiError(
      response.status,
      body?.error.code ?? "REQUEST_FAILED",
      body?.error.message ?? "The request could not be completed.",
    );
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  googleLoginUrl: () => `${API_BASE_URL}/api/auth/google`,
  currentUser: () => request<{ user: UserAccount }>("/api/auth/me"),
  logout: () => request<void>("/api/auth/logout", { method: "POST" }),
  slackConnectUrl: () => `${API_BASE_URL}/api/slack/connect`,
  slackStatus: () => request<SlackStatus>("/api/slack/status"),
  disconnectSlack: () => request<void>("/api/slack/disconnect", { method: "POST" }),
  listEmails: (mailbox: MailboxKind, signal?: AbortSignal) =>
    request<MailboxResponse>(`/api/emails/${mailbox}`, signal ? { signal } : undefined),
  searchEmails: (query: string, status: EmailStatus, signal?: AbortSignal) =>
    request<SearchResult>(
      `/api/emails/search?${new URLSearchParams({ q: query, status, page: "1", limit: "20" })}`,
      signal ? { signal } : undefined,
    ),
  getEmail: (id: string, signal?: AbortSignal) =>
    request<{ email: EmailDetail }>(
      `/api/emails/${encodeURIComponent(id)}`,
      signal ? { signal } : undefined,
    ),
  listSenders: (signal?: AbortSignal) =>
    request<{ senders: Sender[] }>("/api/senders", signal ? { signal } : undefined),
  updateSender: (id: string, payload: UpdateSenderPayload) =>
    request<{ sender: Sender }>(`/api/senders/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  uploadRecipients: (file: File) => {
    const body = new FormData();
    body.append("file", file);
    return request<RecipientUploadResult>("/api/uploads/recipients", { method: "POST", body });
  },
  scheduleEmails: (payload: ScheduleEmailsPayload) =>
    request<ScheduleEmailsResponse>("/api/emails/schedule", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
