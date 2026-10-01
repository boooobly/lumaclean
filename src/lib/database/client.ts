import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { attachDatabasePool } from "@vercel/functions";
import { PrismaClient } from "@/generated/prisma/client";

const globalDatabase = globalThis as unknown as { lumaDatabase?: PrismaClient };

export function getDatabase() {
  if (globalDatabase.lumaDatabase) return globalDatabase.lumaDatabase;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Admin database is not configured");
  // Use Neon pooled URL (-pooler). Small per-instance pool for Vercel concurrency.
  const pool = new Pool({
    connectionString,
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
  });
  // Release idle connections before Vercel Fluid suspends this instance.
  attachDatabasePool(pool);
  const adapter = new PrismaPg(pool);
  globalDatabase.lumaDatabase = new PrismaClient({ adapter });
  return globalDatabase.lumaDatabase;
}
