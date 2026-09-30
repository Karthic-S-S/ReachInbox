import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { Response } from "express";
import { jwtVerify, SignJWT } from "jose";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { rateLimitRedis } from "../config/rate-limit-redis.js";

const slackStateCookieName = `${env.AUTH_COOKIE_NAME}_slack_oauth_state`;
const stateDurationSeconds = 10 * 60;
const hourMs = 60 * 60 * 1_000;

type SlackConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  encryptionKey: string;
};

type SlackTokenResponse = {
  ok: boolean;
  error?: string;
  access_token?: string;
  team?: { id?: string; name?: string };
  incoming_webhook?: { channel_id?: string };
};

function getSlackConfig(): SlackConfig | null {
  if (!env.SLACK_CLIENT_ID || !env.SLACK_CLIENT_SECRET || !env.SLACK_REDIRECT_URI || !env.SLACK_TOKEN_ENCRYPTION_KEY) return null;
  return {
    clientId: env.SLACK_CLIENT_ID,
    clientSecret: env.SLACK_CLIENT_SECRET,
    redirectUri: env.SLACK_REDIRECT_URI,
    encryptionKey: env.SLACK_TOKEN_ENCRYPTION_KEY,
  };
}

function cookieOptions(maxAge: number) {
  return { httpOnly: true, secure: env.NODE_ENV === "production", sameSite: "lax" as const, maxAge, path: "/" };
}

function signingKey() {
  return new TextEncoder().encode(env.AUTH_SESSION_SECRET ?? "");
}

function encryptionKey(value: string) {
  return createHash("sha256").update(value).digest();
}

function encryptToken(token: string, key: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(key), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

function decryptToken(value: string, key: string) {
  const [version, ivValue, tagValue, ciphertext] = value.split(".");
  if (version !== "v1" || !ivValue || !tagValue || !ciphertext) throw new Error("Invalid encrypted Slack token.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(key), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
}

export function isSlackConfigured() {
  return getSlackConfig() !== null;
}

export async function createSlackAuthorization(userId: string, response: Response) {
  const config = getSlackConfig();
  if (!config) return null;
  const state = randomBytes(32).toString("base64url");
  const stateCookie = await new SignJWT({ state, provider: "slack" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${stateDurationSeconds}s`)
    .sign(signingKey());
  response.cookie(slackStateCookieName, stateCookie, cookieOptions(stateDurationSeconds * 1_000));
  const parameters = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: "chat:write,incoming-webhook",
    state,
  });
  return `https://slack.com/oauth/v2/authorize?${parameters.toString()}`;
}

export async function validateSlackState(response: Response, cookieState: string | undefined, state: string | undefined, userId: string) {
  response.clearCookie(slackStateCookieName, { ...cookieOptions(0), maxAge: undefined });
  if (!cookieState || !state) return false;
  try {
    const { payload } = await jwtVerify(cookieState, signingKey(), { algorithms: ["HS256"] });
    if (payload.sub !== userId || payload.provider !== "slack" || typeof payload.state !== "string") return false;
    const expected = Buffer.from(payload.state);
    const received = Buffer.from(state);
    return expected.length === received.length && timingSafeEqual(expected, received);
  } catch {
    return false;
  }
}

export async function saveSlackConnection(userId: string, code: string) {
  const config = getSlackConfig();
  if (!config) throw new Error("Slack OAuth is not configured.");
  const body = new URLSearchParams({ code, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: config.redirectUri });
  const response = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const result = (await response.json().catch(() => null)) as SlackTokenResponse | null;
  const workspaceId = result?.team?.id;
  const channelId = result?.incoming_webhook?.channel_id;
  if (!response.ok || !result?.ok || !result.access_token || !workspaceId || !channelId) throw new Error("Slack OAuth did not return a usable workspace connection.");
  await prisma.slackConnection.upsert({
    where: { userId },
    create: {
      userId,
      workspaceId,
      workspaceName: result.team?.name?.slice(0, 255) ?? null,
      channelId,
      encryptedAccessToken: encryptToken(result.access_token, config.encryptionKey),
    },
    update: {
      workspaceId,
      workspaceName: result.team?.name?.slice(0, 255) ?? null,
      channelId,
      encryptedAccessToken: encryptToken(result.access_token, config.encryptionKey),
    },
  });
}

export async function getSlackStatus(userId: string) {
  const connection = await prisma.slackConnection.findUnique({ where: { userId }, select: { workspaceId: true, workspaceName: true } });
  return connection
    ? { connected: true, workspace: { id: connection.workspaceId, name: connection.workspaceName } }
    : { connected: false };
}

export async function disconnectSlack(userId: string) {
  await prisma.slackConnection.deleteMany({ where: { userId } });
}

export async function notifyRateLimitHit(input: { userId: string; senderId: string; hourlyLimit: number; nextEligibleAt: Date }) {
  const config = getSlackConfig();
  if (!config) return;
  try {
    const connection = await prisma.slackConnection.findUnique({ where: { userId: input.userId } });
    if (!connection?.channelId) return;
    const hourWindow = Math.floor(input.nextEligibleAt.getTime() / hourMs);
    const dedupeKey = `reachinbox:slack:rate-limit-notified:${input.userId}:${input.senderId}:${hourWindow}`;
    const ttl = Math.max(1_000, input.nextEligibleAt.getTime() - Date.now() + hourMs);
    const reserved = await rateLimitRedis.set(dedupeKey, "1", "PX", ttl, "NX");
    if (reserved !== "OK") return;
    const sender = await prisma.sender.findFirst({ where: { id: input.senderId, userId: input.userId }, select: { email: true, displayName: true } });
    if (!sender) return;
    const slackResponse = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: { Authorization: `Bearer ${decryptToken(connection.encryptedAccessToken, config.encryptionKey)}`, "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ channel: connection.channelId, text: `ReachInbox: sender ${sender.displayName ?? sender.email} reached the hourly email limit of ${input.hourlyLimit}. Additional emails have been rescheduled for the next available window.` }),
    });
    const result = (await slackResponse.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (!slackResponse.ok || !result?.ok) console.error({ event: "slack.rate_limit_notification.failed", userId: input.userId, senderId: input.senderId, status: slackResponse.status, slackError: result?.error });
  } catch (error) {
    console.error({ event: "slack.rate_limit_notification.failed", userId: input.userId, senderId: input.senderId, error: error instanceof Error ? error.message : "Unknown error" });
  }
}
