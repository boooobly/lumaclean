import { input, password } from "@inquirer/prompts";
import { loadEnvConfig } from "@next/env";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import { bootstrapAdminSchema } from "../../src/lib/validation/admin";
import { provisionFirstAdmin } from "./provision";
import { pgConnectionString } from "../../src/lib/database/connection";

loadEnvConfig(process.cwd());

async function bootstrap() {
  if (!process.stdin.isTTY) throw new Error("Run from an interactive terminal");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const credentials = bootstrapAdminSchema.parse({
    name: await input({ message: "Имя владельца:" }),
    email: (await input({ message: "Email администратора:" }))
      .trim()
      .toLowerCase(),
    password: await password({
      message: "Пароль (12–128 символов):",
      mask: "*",
    }),
  });
  const repeated = await password({ message: "Повторите пароль:", mask: "*" });
  if (credentials.password !== repeated)
    throw new Error("Passwords do not match");
  const db = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: pgConnectionString(process.env.DATABASE_URL),
      max: 1,
    }),
  });
  try {
    await provisionFirstAdmin(db, credentials);
    console.log("Первый администратор создан. Войдите через /admin/login.");
  } finally {
    await db.$disconnect();
  }
}

bootstrap().catch((error) => {
  // Never print validation inputs, database URLs, passwords or driver traces.
  const message =
    error instanceof Error &&
    [
      "Run from an interactive terminal",
      "DATABASE_URL is required",
      "Passwords do not match",
      "Administrator already exists",
    ].includes(error.message)
      ? error.message
      : "Проверьте ввод, подключение к БД и применение миграций.";
  console.error(`Создание администратора остановлено: ${message}`);
  process.exitCode = 1;
});
