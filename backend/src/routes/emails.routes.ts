import { Router } from "express";
import { getEmail, getScheduledEmails, getSentEmails, scheduleEmails, searchIndexedEmails } from "../controllers/emails.controller.js";
import { requireAuth } from "../middleware/require-auth.js";

export const emailsRouter = Router();

emailsRouter.post("/emails/schedule", requireAuth, (request, response, next) => {
  void scheduleEmails(request, response).catch(next);
});

emailsRouter.get("/emails/search", requireAuth, (request, response, next) => {
  void searchIndexedEmails(request, response).catch(next);
});

emailsRouter.get("/emails/scheduled", requireAuth, (request, response, next) => {
  void getScheduledEmails(request, response).catch(next);
});

emailsRouter.get("/emails/sent", requireAuth, (request, response, next) => {
  void getSentEmails(request, response).catch(next);
});

emailsRouter.get("/emails/:id", requireAuth, (request, response, next) => {
  void getEmail(request, response).catch(next);
});
