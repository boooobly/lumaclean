import assert from "node:assert/strict";
import test from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
test(
  "additive scheduling migration preserves legacy crew/hours and backfills elapsed end",
  { skip: !process.env.ADMIN_TEST_DATABASE_URL },
  async () => {
    const url = new URL(process.env.ADMIN_TEST_DATABASE_URL!);
    assert.equal(url.hostname, "127.0.0.1");
    url.pathname = "/lumaclean_migration_test";
    const db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: url.toString(), max: 1 }),
    });
    try {
      const order = await db.order.findUniqueOrThrow({
        where: { id: "legacy-order" },
      });
      assert.equal(
        order.scheduledEnd!.toISOString(),
        "2026-10-10T14:30:00.000Z",
      );
      assert.equal(
        (
          await db.orderCleaner.findUniqueOrThrow({
            where: { id: "legacy-assignment" },
          })
        ).removedAt,
        null,
      );
      assert.equal(
        await db.cleanerAvailability.count({
          where: { cleanerId: "legacy-cleaner" },
        }),
        1,
      );
      await db.$executeRawUnsafe("SET TIME ZONE 'Europe/Belgrade'");
      await db.$executeRawUnsafe(
        `UPDATE "Order" SET "scheduledStart"='2026-10-24T23:30:00+00'::timestamptz,"manualDurationMinutes"=180 WHERE id='legacy-order'`,
      );
      const [result] = await db.$queryRawUnsafe<
        { end: string; minutes: number }[]
      >(
        `SELECT to_char("scheduledEnd" AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "end",(extract(epoch FROM ("scheduledEnd"-"scheduledStart"))/60)::int AS minutes FROM "Order" WHERE id='legacy-order'`,
      );
      assert.equal(result.end, "2026-10-25T02:30:00Z");
      assert.equal(result.minutes, 180);
      await db.$executeRawUnsafe(
        `UPDATE "Order" SET "scheduledStart"='2026-10-10T12:00:00+00'::timestamptz,"manualDurationMinutes"=NULL WHERE id='legacy-order'`,
      );
      await db.$executeRawUnsafe("SET TIME ZONE 'UTC'");
    } finally {
      await db.$disconnect();
    }
  },
);
