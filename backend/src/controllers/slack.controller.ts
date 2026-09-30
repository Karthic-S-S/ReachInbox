import type { Request, Response } from "express";
import { env } from "../config/env.js";
import { readCookie } from "../middleware/require-auth.js";
import { createSlackAuthorization, disconnectSlack, getSlackStatus, isSlackConfigured, saveSlackConnection, validateSlackState } from "../services/slack.service.js";

function frontendRedirect(result: "connected" | "error") {
  return `${env.FRONTEND_URL}/mail?slack=${result}`;
}

export async function connectSlack(request: Request, response: Response) {
  const authorizationUrl = await createSlackAuthorization(request.authenticatedUser!.id, response);
  if (!authorizationUrl) {
    response.status(503).json({ error: { code: "SLACK_NOT_CONFIGURED", message: "Slack OAuth is not configured." } });
    return;
  }
  response.redirect(authorizationUrl);
}

export async function completeSlackConnection(request: Request, response: Response) {
  const state = typeof request.query.state === "string" ? request.query.state : undefined;
  const code = typeof request.query.code === "string" ? request.query.code : undefined;
  const cookieState = readCookie(request.headers.cookie, `${env.AUTH_COOKIE_NAME}_slack_oauth_state`);
  const validState = await validateSlackState(response, cookieState, state, request.authenticatedUser!.id);
  if (!validState || !code || !isSlackConfigured()) {
    response.status(400).json({ error: { code: "SLACK_OAUTH_CALLBACK_INVALID", message: "The Slack connection request is invalid or has expired." } });
    return;
  }
  try {
    await saveSlackConnection(request.authenticatedUser!.id, code);
    response.redirect(frontendRedirect("connected"));
  } catch {
    response.redirect(frontendRedirect("error"));
  }
}

export async function slackStatus(request: Request, response: Response) {
  response.json(await getSlackStatus(request.authenticatedUser!.id));
}

export async function disconnectSlackConnection(request: Request, response: Response) {
  await disconnectSlack(request.authenticatedUser!.id);
  response.status(204).send();
}
