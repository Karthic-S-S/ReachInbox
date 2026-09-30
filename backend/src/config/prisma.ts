import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client.js";
import { env } from "./env.js";

const databaseUrl = new URL(env.DATABASE_URL);

const adapter = new PrismaMariaDb({
  host: databaseUrl.hostname,
  port: databaseUrl.port ? Number(databaseUrl.port) : 3306,
  user: decodeURIComponent(databaseUrl.username),
  password: decodeURIComponent(databaseUrl.password),
  database: databaseUrl.pathname.slice(1),
  connectionLimit: 5,
  // MySQL 8's default caching_sha2_password authentication needs the server's
  // RSA key for this local, non-TLS Docker connection. Keep this opt-in via URL.
  allowPublicKeyRetrieval:
    databaseUrl.searchParams.get("allowPublicKeyRetrieval") === "true" ||
    (env.NODE_ENV === "development" && ["localhost", "127.0.0.1", "::1"].includes(databaseUrl.hostname)),
});

export const prisma = new PrismaClient({ adapter });
