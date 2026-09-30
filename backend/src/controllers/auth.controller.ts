import type { Request, Response } from "express";
import { env } from "../config/env.js";
import { readCookie } from "../middleware/require-auth.js";
import { clearSession, consumeOAuthState, findOrCreateGoogleUser, getGoogleAuthorizationUrl, setOAuthState, setSession } from "../services/auth.service.js";

export function beginGoogleLogin(_request: Request, response: Response) {
  response.redirect(getGoogleAuthorizationUrl(setOAuthState(response)));
}

export async function completeGoogleLogin(request: Request, response: Response) {
  const state = typeof request.query.state === "string" ? request.query.state : undefined;
  const code = typeof request.query.code === "string" ? request.query.code : undefined;
  const cookieState = readCookie(request.headers.cookie, `${env.AUTH_COOKIE_NAME}_oauth_state`);
  if (!consumeOAuthState(response, state, cookieState) || !code) {
    response.status(400).json({ error: { code: "OAUTH_CALLBACK_INVALID", message: "The Google sign-in request is invalid or has expired." } });
    return;
  }
  try {
    const user = await findOrCreateGoogleUser(code);
    await setSession(response, user.id);
    response.redirect(new URL("/mail", env.FRONTEND_URL).toString());
  } catch {
    response.status(401).json({ error: { code: "GOOGLE_AUTH_FAILED", message: "Google sign-in could not be completed." } });
  }
}

export function getCurrentUser(request: Request, response: Response) {
  response.json({ user: request.authenticatedUser });
}

export function logout(_request: Request, response: Response) {
  clearSession(response);
  response.status(204).send();
}
