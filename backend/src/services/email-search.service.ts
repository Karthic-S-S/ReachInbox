import type { Email } from "../generated/prisma/client.js";
import type { estypes } from "@elastic/elasticsearch";
import { env } from "../config/env.js";
import { elasticsearch } from "../config/elasticsearch.js";
import { prisma } from "../config/prisma.js";

const emailIndex = env.ELASTICSEARCH_INDEX;

export type EmailSearchDocument = {
  id: string;
  campaignId: string;
  senderId: string;
  recipient: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EmailSearchInput = {
  q?: string;
  status?: string;
  senderId?: string;
  campaignId?: string;
  page: number;
  limit: number;
};

function toSearchDocument(email: Email): EmailSearchDocument {
  return {
    id: email.id,
    campaignId: email.campaignId,
    senderId: email.senderId,
    recipient: email.recipientEmail,
    subject: email.subject,
    body: email.htmlBody,
    status: email.status,
    scheduledAt: email.scheduledAt?.toISOString() ?? null,
    sentAt: email.sentAt?.toISOString() ?? null,
    createdAt: email.createdAt.toISOString(),
    updatedAt: email.updatedAt.toISOString(),
  };
}

export async function initializeEmailSearchIndex() {
  if (await elasticsearch.indices.exists({ index: emailIndex })) return;

  await elasticsearch.indices.create({
    index: emailIndex,
    mappings: {
      dynamic: "strict",
      properties: {
        id: { type: "keyword" },
        campaignId: { type: "keyword" },
        senderId: { type: "keyword" },
        recipient: { type: "text", fields: { keyword: { type: "keyword" } } },
        subject: { type: "text" },
        body: { type: "text" },
        status: { type: "keyword" },
        scheduledAt: { type: "date" },
        sentAt: { type: "date" },
        createdAt: { type: "date" },
        updatedAt: { type: "date" },
      },
    },
  });
}

export async function indexEmail(email: Email) {
  await elasticsearch.index({ index: emailIndex, id: email.id, document: toSearchDocument(email) });
}

export async function syncEmailSearchDocument(emailId: string) {
  const email = await prisma.email.findUnique({ where: { id: emailId } });
  if (!email) return false;

  try {
    await indexEmail(email);
    return true;
  } catch (error) {
    console.error({ event: "email.search_index.failed", emailId, error });
    return false;
  }
}

export async function searchEmails(input: EmailSearchInput) {
  const filters: estypes.QueryDslQueryContainer[] = [
    ...(input.status ? [{ term: { status: input.status } }] : []),
    ...(input.senderId ? [{ term: { senderId: input.senderId } }] : []),
    ...(input.campaignId ? [{ term: { campaignId: input.campaignId } }] : []),
  ];
  const searchTerm = input.q?.trim();
  const isExactEmail = Boolean(searchTerm && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(searchTerm));
  const query: estypes.QueryDslQueryContainer = searchTerm
    ? isExactEmail
      ? { bool: { filter: [...filters, { term: { "recipient.keyword": searchTerm } }] } }
      : {
        bool: {
          filter: filters,
          should: [
            { term: { "recipient.keyword": searchTerm } },
            { multi_match: { query: searchTerm, fields: ["recipient^3", "subject^2", "body"], type: "best_fields" as const } },
          ],
          minimum_should_match: 1,
        },
      }
    : { bool: { filter: filters } };
  const result = await elasticsearch.search<EmailSearchDocument>({
    index: emailIndex,
    from: (input.page - 1) * input.limit,
    size: input.limit,
    track_total_hits: true,
    query,
  });
  const total = typeof result.hits.total === "number" ? result.hits.total : (result.hits.total?.value ?? 0);

  return {
    data: result.hits.hits.flatMap((hit) => (hit._source ? [toSearchResponse(hit._source)] : [])),
    pagination: { page: input.page, limit: input.limit, total },
  };
}

function toSearchResponse(document: EmailSearchDocument) {
  return {
    id: document.id,
    recipient: document.recipient,
    subject: document.subject,
    status: document.status,
    scheduledAt: document.scheduledAt,
    sentAt: document.sentAt,
    campaignId: document.campaignId,
    senderId: document.senderId,
  };
}

export async function rebuildEmailSearchIndex() {
  await elasticsearch.indices.delete({ index: emailIndex, ignore_unavailable: true });
  await initializeEmailSearchIndex();

  let cursor: string | undefined;
  let indexed = 0;
  let failed = 0;
  do {
    const emails = await prisma.email.findMany({
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: "asc" },
      take: 100,
    });
    for (const email of emails) {
      try {
        await indexEmail(email);
        indexed += 1;
      } catch (error) {
        failed += 1;
        console.error({ event: "email.search_reindex.failed", emailId: email.id, error });
      }
    }
    cursor = emails.at(-1)?.id;
    if (emails.length < 100) break;
  } while (cursor);

  await elasticsearch.indices.refresh({ index: emailIndex });
  return { indexed, failed };
}

export async function closeElasticsearch() {
  await elasticsearch.close();
}
