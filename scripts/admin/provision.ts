import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import type { PrismaClient } from "../../src/generated/prisma/client";
import { bootstrapAdminSchema } from "../../src/lib/validation/admin";

// CLI-only: never import from an HTTP handler or Server Action.
export async function provisionFirstAdmin(db: PrismaClient, input: unknown) {
  const credentials = bootstrapAdminSchema.parse(input);
  const hashed = await hashPassword(credentials.password);
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(48201401)`;
      if (await tx.user.count({ where: { role: "ADMIN" } }))
        throw new Error("Administrator already exists");
      const id = randomUUID();
      await tx.user.create({
        data: {
          id,
          name: credentials.name,
          email: credentials.email.toLowerCase(),
          emailVerified: true,
          role: "ADMIN",
          active: true,
          accounts: {
            create: {
              accountId: id,
              providerId: "credential",
              password: hashed,
            },
          },
        },
      });
      await tx.auditLog.create({
        data: {
          actorType: "SYSTEM",
          actorKey: "admin-bootstrap",
          action: "ADMIN_CREATED",
          entityType: "User",
          entityId: id,
        },
      });
      return id;
    },
    { timeout: 15_000 },
  );
}
