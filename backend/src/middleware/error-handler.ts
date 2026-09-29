import type { ErrorRequestHandler, RequestHandler } from "express";

export const notFoundHandler: RequestHandler = (request, response) => {
  response.status(404).json({ error: { code: "NOT_FOUND", message: `Route ${request.method} ${request.path} was not found.` } });
};

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  const status = typeof error.status === "number" ? error.status : 500;
  const message = status >= 500 ? "An unexpected server error occurred." : error.message;
  if (status >= 500) console.error(error);
  response.status(status).json({ error: { code: status >= 500 ? "INTERNAL_SERVER_ERROR" : "REQUEST_ERROR", message } });
};
