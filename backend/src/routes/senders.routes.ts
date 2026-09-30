import { Router } from "express";
import { createSender, deleteSender, getSender, listSenders, updateSender } from "../controllers/senders.controller.js";
import { requireAuth } from "../middleware/require-auth.js";

export const sendersRouter = Router();
sendersRouter.get("/senders", requireAuth, (request, response, next) => void listSenders(request, response).catch(next));
sendersRouter.post("/senders", requireAuth, (request, response, next) => void createSender(request, response).catch(next));
sendersRouter.get("/senders/:id", requireAuth, (request, response, next) => void getSender(request, response).catch(next));
sendersRouter.patch("/senders/:id", requireAuth, (request, response, next) => void updateSender(request, response).catch(next));
sendersRouter.delete("/senders/:id", requireAuth, (request, response, next) => void deleteSender(request, response).catch(next));
