import "server-only";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { getDatabase } from "@/lib/database/client";

export function isAuthConfigured() {
  return Boolean(
    process.env.DATABASE_URL &&
    process.env.BETTER_AUTH_URL &&
    (process.env.BETTER_AUTH_SECRET?.length || 0) >= 32,
  );
}

let instance: ReturnType<typeof createAuth> | undefined;
function createAuth() {
  if (!isAuthConfigured())
    throw new Error("Admin authentication is not configured");
  const db = getDatabase();
  return betterAuth({
    appName: "LumaClean Admin",
    logger: { disabled: true },
    baseURL: process.env.VERCEL_ENV==='preview'&&process.env.VERCEL_URL?`https://${process.env.VERCEL_URL}`:process.env.BETTER_AUTH_URL,
    trustedOrigins: [process.env.BETTER_AUTH_URL!,...(process.env.VERCEL_ENV==='preview'&&process.env.VERCEL_URL?[`https://${process.env.VERCEL_URL}`]:[])],
    secret: process.env.BETTER_AUTH_SECRET,
    database: prismaAdapter(db, { provider: "postgresql" }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
    },
    user: {
      additionalFields: {
        role: {
          type: ["ADMIN", "CLEANER"],
          defaultValue: "CLEANER",
          input: false,
        },
        active: { type: "boolean", defaultValue: true, input: false },
      },
    },
    session: { expiresIn: 60 * 60 * 12, cookieCache: { enabled: false } },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 60,
      customRules: { "/sign-in/email": { window: 60, max: 5 } },
    },
    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            const user = await db.user.findUnique({
              where: { id: session.userId },
              select: { active: true },
            });
            if (!user?.active)
              throw new APIError("UNAUTHORIZED", {
                message: "Invalid credentials",
              });
          },
        },
      },
    },
  });
}

export function getAuth() {
  instance ??= createAuth();
  return instance;
}
