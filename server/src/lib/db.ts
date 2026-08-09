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
    dotenv.config({ path: envPath, quiet: true });
    break;
  }
}

// Suppress only pg-related SSL/TLS warnings, not all process warnings
const originalEmit = process.emit.bind(process);
process.emit = function (event: string, ...args: any[]) {
  if (
    event === "warning" &&
    typeof args[0]?.message === "string" &&
    args[0].message.includes("TLS")
  ) {
    return false;
  }
  return originalEmit(event, ...args);
} as typeof process.emit;

let connectionString = process.env.DATABASE_URL;
if (connectionString && connectionString.includes("sslmode=require")) {
  connectionString = connectionString.replace("sslmode=require", "sslmode=verify-full");
}

const pool = new pg.Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  // Production pool limits
  max: 5,                       // Max connections (CLI rarely needs more than 1)
  connectionTimeoutMillis: 10000, // Fail after 10s if DB is unreachable
  idleTimeoutMillis: 5000,       // Release idle connections quickly (important for CLI exit)
});

// Handle unexpected pool errors to prevent unhandled rejections
pool.on("error", (err) => {
  console.error("Unexpected database pool error:", err.message);
});

const adapter = new PrismaPg(pool);

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const db = globalForPrisma.prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

// Signal to CLI entry point that the db module has been loaded
(globalThis as any).__metis_db_loaded = true;

/**
 * Cleanly disconnect Prisma and the underlying pg pool.
 * Call this at the end of CLI commands so Node.js can exit.
 * Safe to call even if no queries were made.
 */
export async function disconnectDb() {
  try {
    await db.$disconnect();
  } catch (_) {}
  try {
    await pool.end();
  } catch (_) {}
}