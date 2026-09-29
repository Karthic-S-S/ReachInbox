import { Router } from "express";
import { getScheduledEmails, getSentEmails, scheduleEmails } from "../controllers/emails.controller.js";

export const emailsRouter = Router();

emailsRouter.post("/emails/schedule", (request, response, next) => {
  void scheduleEmails(request, response).catch(next);
});

emailsRouter.get("/emails/scheduled", (request, response, next) => {
  void getScheduledEmails(request, response).catch(next);
});

emailsRouter.get("/emails/sent", (request, response, next) => {
  void getSentEmails(request, response).catch(next);
});
