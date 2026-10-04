import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { verifyPassword } from "better-auth/crypto";
import { PrismaClient } from "../../src/generated/prisma/client";
import { provisionFirstAdmin } from "../../scripts/admin/provision";

const dbUrl = process.env.ADMIN_TEST_DATABASE_URL;
test(
  "first-admin provisioning is atomic, stores only a hash and preserves audit",
  { skip: !dbUrl },
  async () => {
    const url = new URL(dbUrl!);
    assert.equal(url.hostname, "127.0.0.1");
    assert.equal(url.pathname, "/lumaclean_admin_test");
    url.pathname = "/lumaclean_admin_bootstrap_test";
    const db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: url.toString(), max: 2 }),
    });
    const secret = randomUUID() + "aA!7";
    try {
      assert.equal(
        await db.user.count(),
        0,
        "Use a fresh bootstrap test database",
      );
      const attempt = () =>
        provisionFirstAdmin(db, {
          name: "Local test",
          email: `${randomUUID()}@example.test`,
          password: secret,
        });
      const results = await Promise.allSettled([attempt(), attempt()]);
      assert.equal(
        results.filter((result) => result.status === "fulfilled").length,
        1,
      );
      assert.equal(
        results.filter((result) => result.status === "rejected").length,
        1,
      );
      assert.equal(await db.user.count({ where: { role: "ADMIN" } }), 1);
      const account = await db.account.findFirstOrThrow();
      assert.notEqual(account.password, secret);
      assert.equal(
        await verifyPassword({ hash: account.password!, password: secret }),
        true,
      );
      const audit = await db.auditLog.findFirstOrThrow({
        where: { action: "ADMIN_CREATED" },
      });
      await assert.rejects(
        db.auditLog.update({
          where: { id: audit.id },
          data: { action: "MODIFIED" },
        }),
      );
      await assert.rejects(db.auditLog.delete({ where: { id: audit.id } }));
      await assert.rejects(attempt(), /Administrator already exists/);
    } finally {
      await db.$disconnect();
    }
  },
);
