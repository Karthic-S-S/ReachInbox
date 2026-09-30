import { app } from "./app.js";
import { env } from "./config/env.js";
import { closeElasticsearch, initializeEmailSearchIndex } from "./services/email-search.service.js";
import { prisma } from "./config/prisma.js";

const server = app.listen(env.PORT, () => console.info(`API listening on port ${env.PORT}`));
void initializeEmailSearchIndex().catch((error) => console.error({ event: "email.search_index.initialize_failed", error }));

async function shutdown(signal: string) {
  console.info(`${signal} received, shutting down.`);
  server.close(async () => {
    await prisma.$disconnect();
    await closeElasticsearch();
    process.exit(0);
  });
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
