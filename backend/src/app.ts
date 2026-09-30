import cors from "cors";
import express from "express";
import { bullBoardRouter } from "./config/bull-board.js";
import { env } from "./config/env.js";
import { emailsRouter } from "./routes/emails.routes.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { healthRouter } from "./routes/health.routes.js";
import { testRouter } from "./routes/test.routes.js";

export const app = express();
app.disable("x-powered-by");
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use("/api", healthRouter);
app.use("/api", emailsRouter);
app.use("/api/test", testRouter);

if (env.BULL_BOARD_ENABLED) {
  app.use("/admin/queues", bullBoardRouter);
}

app.use(notFoundHandler);
app.use(errorHandler);
