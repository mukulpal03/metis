import "dotenv/config";
import express from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth";
import cors from "cors";

const app = express();

app.use(
  cors({
    origin: [process.env.FRONTEND_URL || "http://localhost:3001", "http://127.0.0.1:3001"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(express.json());

const PORT = process.env.PORT || 3000;

app.get("/health", (_, res) => {
  return res.status(200).json({});
});

app.listen(PORT, () => {
  console.log("Server is running on port", PORT);
});
