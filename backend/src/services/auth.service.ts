import { randomBytes, timingSafeEqual } from "node:crypto";
import type { Response } from "express";
import { OAuth2Client } from "google-auth-library";
import { jwtVerify, SignJWT } from "jose";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";

const sessionDurationSeconds = 60 * 60 * 8;
const stateDurationMs = 10 * 60 * 1000;
const stateCookieName = `${env.AUTH_COOKIE_NAME}_oauth_state`;
const sessionSecret = new TextEncoder().encode(env.AUTH_SESSION_SECRET ?? "");
const userSelection = { id: true, name: true, email: true, avatar: true } as const;

export type AuthenticatedUser = { id: string; name: string | null; email: string; avatar: string | null };

function cookieOptions(maxAge: number) {
  return { httpOnly: true, secure: env.NODE_ENV === "production", sameSite: "lax" as const, maxAge, path: "/" };
}

export function setOAuthState(response: Response) {
  const state = randomBytes(32).toString("base64url");
  response.cookie(stateCookieName, state, cookieOptions(stateDurationMs));
  return state;
}

export function consumeOAuthState(response: Response, receivedState: string | undefined, cookieState: string | undefined) {
  response.clearCookie(stateCookieName, { ...cookieOptions(0), maxAge: undefined });
  if (!receivedState || !cookieState) return false;
  const expected = Buffer.from(cookieState);
  const received = Buffer.from(receivedState);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function getGoogleAuthorizationUrl(state: string) {
  const client = new OAuth2Client(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_CALLBACK_URL);
  return client.generateAuthUrl({ access_type: "offline", prompt: "select_account", scope: ["openid", "email", "profile"], state });
}

export async function findOrCreateGoogleUser(code: string): Promise<AuthenticatedUser> {
  const client = new OAuth2Client(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_CALLBACK_URL);
  const { tokens } = await client.getToken(code);
  if (!tokens.id_token) throw new Error("Google did not return an identity token.");
  const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: env.GOOGLE_CLIENT_ID });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email || !payload.email_verified) throw new Error("Google did not verify an email address.");

  const googleId = payload.sub;
  const email = payload.email.toLowerCase();
  const name = payload.name?.slice(0, 255) ?? null;
  const avatar = payload.picture?.slice(0, 2048) ?? null;
  return prisma.$transaction(async (transaction) => {
    const existingGoogleUser = await transaction.user.findUnique({ where: { googleId } });
    if (existingGoogleUser) return transaction.user.update({ where: { id: existingGoogleUser.id }, data: { name, avatar }, select: userSelection });
    const existingEmailUser = await transaction.user.findUnique({ where: { email } });
    if (existingEmailUser) {
      // A local account is linked only after Google verifies control of the same email address.
      return transaction.user.update({ where: { id: existingEmailUser.id }, data: { googleId, name, avatar }, select: userSelection });
    }
    return transaction.user.create({ data: { googleId, email, name, avatar }, select: userSelection });
  });
}

export async function setSession(response: Response, userId: string) {
  const token = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject(userId).setIssuedAt().setExpirationTime(`${sessionDurationSeconds}s`).sign(sessionSecret);
  response.cookie(env.AUTH_COOKIE_NAME, token, cookieOptions(sessionDurationSeconds * 1000));
}

export function clearSession(response: Response) {
  response.clearCookie(env.AUTH_COOKIE_NAME, { ...cookieOptions(0), maxAge: undefined });
}

export async function getSessionUser(token: string | undefined): Promise<AuthenticatedUser | null> {
  if (!env.AUTH_ENABLED || !token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionSecret, { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    return prisma.user.findUnique({ where: { id: payload.sub }, select: userSelection });
  } catch {
    return null;
  }
}
