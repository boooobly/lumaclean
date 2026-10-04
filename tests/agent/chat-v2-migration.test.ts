import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "pg";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { pgConnectionString } from "../../src/lib/database/connection";
const url = process.env.CHAT_V2_TEST_DATABASE_URL;
test(
  "additive Chat V2 migration preserves orders, mode and duplicate legacy history",
  { skip: !url },
  async () => {
    assert(new URL(url!).hostname.startsWith("ep-wispy-river-b8xwqy9q"));
    const schema = "chat_v2_migration_" + randomUUID().replaceAll("-", "");
    assert(/^chat_v2_migration_[a-f0-9]{32}$/.test(schema));
    const direct=new URL(url!);direct.hostname=direct.hostname.replace('-pooler.','.');
    const db = new Client({ connectionString: pgConnectionString(direct.toString()),query_timeout:30000 });
    await db.connect();
    try {
      await db.query(`CREATE SCHEMA "${schema}"`);
      await db.query(`SET search_path TO "${schema}", public`);
      const target = "20261004130000_website_chat_v2";
      for (const directory of readdirSync("prisma/migrations")
        .filter((d) => /^\d/.test(d) && d < target)
        .sort())
        await db.query(
          readFileSync(`prisma/migrations/${directory}/migration.sql`, "utf8"),
        );
      await db.query(
        `INSERT INTO "BusinessSettings" (id,"updatedAt","aiAgentMode") VALUES ('default',now(),'AUTO') ON CONFLICT (id) DO UPDATE SET "aiAgentMode"='AUTO'; INSERT INTO "Conversation" (id,channel,"updatedAt") VALUES ('legacy','WEBSITE',now()); INSERT INTO "Message" (id,"conversationId",author,text,"externalMessageId") VALUES ('source','legacy','CLIENT','Preserve customer','in:legacy'),('answer1','legacy','AI','Preserve first answer','agent:legacy-job:1'),('answer2','legacy','AI','Preserve legacy duplicate','agent:legacy-job:2'); INSERT INTO "AgentJob" (id,"conversationId","messageId",status) VALUES ('legacy-job','legacy','source','DONE'); INSERT INTO "Client" (id,name,phone,"updatedAt") VALUES ('legacy-client','Synthetic','0641234567',now()); INSERT INTO "ClientAddress" (id,"clientId","fullAddress","updatedAt") VALUES ('legacy-address','legacy-client','Synthetic',now()); INSERT INTO "Service" (id,code,name,"updatedAt") VALUES ('legacy-service','regular','Synthetic',now()); INSERT INTO "Order" (id,"clientId","addressId","serviceId",area,"basePrice","finalPrice","travelBufferMinutes","updatedAt") VALUES ('legacy-order','legacy-client','legacy-address','legacy-service',60,5700,5700,30,now());`,
      );
      const before = (await db.query('SELECT * FROM "Order"')).rows,
        messages = (await db.query('SELECT id,text FROM "Message" ORDER BY id'))
          .rows;
      await db.query(
        readFileSync(`prisma/migrations/${target}/migration.sql`, "utf8"),
      );
      assert.deepEqual((await db.query('SELECT * FROM "Order"')).rows, before);
      assert.deepEqual(
        (await db.query('SELECT id,text FROM "Message" ORDER BY id')).rows,
        messages,
      );
      assert.equal(
        (await db.query('SELECT "aiAgentMode" FROM "BusinessSettings"')).rows[0]
          .aiAgentMode,
        "AUTO",
      );
      assert.equal(
        (
          await db.query(
            'SELECT count(*)::int AS n FROM "Message" WHERE "responseToMessageId" IS NOT NULL',
          )
        ).rows[0].n,
        1,
      );
      await assert.rejects(
        db.query(
          `INSERT INTO "Message" (id,"conversationId",author,text,"responseToMessageId") VALUES ('new-duplicate','legacy','AI','Forbidden','source')`,
        ),
      );
    } finally {
      try{await db.query('ROLLBACK');await db.query("SET search_path TO public");await db.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);}finally{await db.end();}
    }
  },
);

