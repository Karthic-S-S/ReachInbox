import { closeElasticsearch, rebuildEmailSearchIndex } from "../services/email-search.service.js";
import { prisma } from "../config/prisma.js";

try {
  const result = await rebuildEmailSearchIndex();
  console.info({ event: "email.search_reindex.completed", ...result });
  process.exitCode = result.failed > 0 ? 1 : 0;
} catch (error) {
  console.error({ event: "email.search_reindex.failed", error });
  process.exitCode = 1;
} finally {
  await closeElasticsearch();
  await prisma.$disconnect();
}
