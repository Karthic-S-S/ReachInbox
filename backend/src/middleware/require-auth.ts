import type { RequestHandler } from "express";
import { env } from "../config/env.js";
import { getSessionUser } from "../services/auth.service.js";

export function readCookie(header: string | undefined, name: string) {
  return header?.split(";").map((value) => value.trim()).find((value) => value.startsWith(`${name}=`))?.slice(name.length + 1);
}

export const requireAuth: RequestHandler = (request, response, next) => {
  void getSessionUser(readCookie(request.headers.cookie, env.AUTH_COOKIE_NAME)).then((user) => {
    if (!user) {
      response.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Authentication is required." } });
      return;
    }
    request.authenticatedUser = user;
    next();
  }).catch(next);
};
