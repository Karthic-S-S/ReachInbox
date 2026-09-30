import { Router } from "express";
import { beginGoogleLogin, completeGoogleLogin, getCurrentUser, logout } from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/require-auth.js";

export const authRouter = Router();
authRouter.get("/auth/google", beginGoogleLogin);
authRouter.get("/auth/google/callback", (request, response, next) => void completeGoogleLogin(request, response).catch(next));
authRouter.get("/auth/me", requireAuth, getCurrentUser);
authRouter.post("/auth/logout", logout);
