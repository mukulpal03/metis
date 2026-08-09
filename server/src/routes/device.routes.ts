import { Router, Request, Response } from "express";

export const deviceRouter = Router();

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3001";

/**
 * GET /device
 * Redirects device code authorization requests from backend to frontend URL with user_code query param.
 */
deviceRouter.get("/device", (req: Request, res: Response) => {
  const { user_code } = req.query;

  const targetUrl = new URL("/device", FRONTEND_URL);

  if (user_code && typeof user_code === "string") {
    targetUrl.searchParams.set("user_code", user_code);
  } else {
    // Forward any existing query params if user_code is passed under a different key
    Object.entries(req.query).forEach(([key, val]) => {
      if (typeof val === "string") {
        targetUrl.searchParams.set(key, val);
      }
    });
  }

  return res.redirect(targetUrl.toString());
});
