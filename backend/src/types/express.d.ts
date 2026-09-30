import type { User } from "../generated/prisma/client.js";

declare global {
  namespace Express {
    interface Request {
      authenticatedUser?: Pick<User, "id" | "name" | "email" | "avatar">;
    }
  }
}

export {};
