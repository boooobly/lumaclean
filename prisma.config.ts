import { loadEnvConfig } from "@next/env";
import { defineConfig } from "prisma/config";

loadEnvConfig(process.cwd());

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  // Generation/validation work without credentials; DB commands require a real URL.
  datasource: { url: process.env.DIRECT_URL || process.env.DATABASE_URL || "" },
});
