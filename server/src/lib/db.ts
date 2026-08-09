import "dotenv/config";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const envPaths = [
  path.join(process.cwd(), ".env"),
  path.join(process.cwd(), "server", ".env"),
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

// Suppress Node.js process warnings for pg SSL modes to keep CLI UX clean
process.removeAllListeners("warning");

let connectionString = process.env.DATABASE_URL;
if (connectionString && connectionString.includes("sslmode=require")) {
  connectionString = connectionString.replace("sslmode=require", "sslmode=verify-full");
}

const pool = new pg.Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const db = globalForPrisma.prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;