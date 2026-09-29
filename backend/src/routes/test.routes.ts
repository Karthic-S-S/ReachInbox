import { Router } from "express";
import { enqueueTestJob } from "../controllers/test-queue.controller.js";
import { env } from "../config/env.js";

export const testRouter = Router();

testRouter.post("/queue", (request, response, next) => {
  if (env.NODE_ENV !== "development") {
    response.sendStatus(404);
    return;
  }

  void enqueueTestJob(request, response).catch(next);
});
