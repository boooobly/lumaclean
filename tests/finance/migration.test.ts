import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { Client } from "pg";
import test from "node:test";
const url = process.env.ADMIN_TEST_DATABASE_URL;
test(
  "additive migration preserves existing CRM, schedule, expenses and duration versions",
  { skip: !url },
  async () => {
    const parsed = new URL(url!);
    assert.equal(parsed.hostname, "127.0.0.1");
    assert.equal(parsed.pathname, "/lumaclean_admin_test");
    const control = new Client({ connectionString: url! });
    await control.connect();
    await control.query("CREATE DATABASE lumaclean_finance_migration");
    await control.end();
    parsed.pathname = "/lumaclean_finance_migration";
    const db = new Client({ connectionString: parsed.toString() });
    await db.connect();
    try {
      const dirs = readdirSync("prisma/migrations")
          .filter((d) => /^\d/.test(d))
          .sort(),
        target = "20261001193000_admin_finance_duration";
      for (const d of dirs.filter((d) => d < target))
        await db.query(
          readFileSync(`prisma/migrations/${d}/migration.sql`, "utf8"),
        );
      await db.query(
        `INSERT INTO "Client" (id,name,phone,"updatedAt") VALUES ('legacy-client','Legacy fixture','0641234567',now()); INSERT INTO "ClientAddress" (id,"clientId","fullAddress","updatedAt") VALUES ('legacy-address','legacy-client','Existing real-looking test address',now()); INSERT INTO "Service" (id,code,name,"updatedAt") VALUES ('legacy-service','regular','Regular',now()); INSERT INTO "DurationRule" (id,"serviceId",version,"cleanerCount","baseMinutes","minutesPerSquare") VALUES ('legacy-rule','legacy-service',1,2,180,1); INSERT INTO "Order" (id,"clientId","addressId","serviceId",area,"travelBufferMinutes","manualDurationMinutes","durationRuleId","updatedAt") VALUES ('legacy-order','legacy-client','legacy-address','legacy-service',70,30,180,'legacy-rule',now()); INSERT INTO "Expense" (id,category,amount,"occurredAt",description,"updatedAt") VALUES ('legacy-expense','OTHER',123,now(),'Preserve this',now());`,
      );
      const select = `SELECT "clientId","addressId","serviceId",area::text,"travelBufferMinutes","manualDurationMinutes","durationRuleId","scheduledStart","scheduledEnd",status::text FROM "Order" WHERE id='legacy-order'`;
      const before = (await db.query(select)).rows[0];
      await db.query(
        readFileSync(`prisma/migrations/${target}/migration.sql`, "utf8"),
      );
      assert.deepEqual((await db.query(select)).rows[0], before);
      assert.equal(
        (
          await db.query(
            "SELECT amount::text FROM \"Expense\" WHERE id='legacy-expense'",
          )
        ).rows[0].amount,
        "123.00",
      );
      assert.equal(
        (
          await db.query(
            'SELECT version,"baseMinutes" FROM "DurationRule" WHERE id=\'legacy-rule\'',
          )
        ).rows[0].baseMinutes,
        180,
      );
      assert.equal(
        (await db.query('SELECT COUNT(*)::int AS n FROM "ImportRecord"'))
          .rows[0].n,
        0,
      );
    } finally {
      await db.end();
    }
  },
);
