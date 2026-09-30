import multer from "multer";
import { Router, type NextFunction, type Request, type Response } from "express";
import { uploadRecipients } from "../controllers/uploads.controller.js";
import { requireAuth } from "../middleware/require-auth.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1_000_000, files: 1 } });

function recipientFile(request: Request, response: Response, next: NextFunction) {
  upload.single("file")(request, response, (error: unknown) => {
    if (error) {
      response.status(400).json({ error: { code: "UPLOAD_INVALID", message: "The recipient upload is invalid or exceeds 1 MB." } });
      return;
    }
    next();
  });
}

export const uploadsRouter = Router();
uploadsRouter.post("/uploads/recipients", requireAuth, recipientFile, uploadRecipients);
