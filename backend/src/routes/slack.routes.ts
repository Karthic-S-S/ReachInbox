import { Router } from "express";
import { completeSlackConnection, connectSlack, disconnectSlackConnection, slackStatus } from "../controllers/slack.controller.js";
import { requireAuth } from "../middleware/require-auth.js";

export const slackRouter = Router();
slackRouter.get("/slack/connect", requireAuth, (request, response, next) => void connectSlack(request, response).catch(next));
slackRouter.get("/slack/callback", requireAuth, (request, response, next) => void completeSlackConnection(request, response).catch(next));
slackRouter.get("/slack/status", requireAuth, (request, response, next) => void slackStatus(request, response).catch(next));
slackRouter.post("/slack/disconnect", requireAuth, (request, response, next) => void disconnectSlackConnection(request, response).catch(next));
