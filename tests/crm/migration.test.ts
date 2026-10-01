import assert from "node:assert/strict";
import test from "node:test";
import {PrismaPg} from "@prisma/adapter-pg";
import {PrismaClient} from "../../src/generated/prisma/client";
import {backfillPhones} from "../../src/lib/services/crm-backfill";
const dbUrl=process.env.ADMIN_TEST_DATABASE_URL;
test("additive migration preserves legacy records and phone backfill is idempotent",{skip:!dbUrl},async()=>{
  const url=new URL(dbUrl!);assert.equal(url.hostname,"127.0.0.1");assert.equal(url.pathname,"/lumaclean_admin_test");url.pathname="/lumaclean_migration_test";
  const db=new PrismaClient({adapter:new PrismaPg({connectionString:url.toString(),max:1})});
  try{const order=await db.order.findUniqueOrThrow({where:{id:"legacy-order"}});assert.equal(order.soilLevel,"HEAVY");assert.equal(order.reference,"ORD-LEGACY-legacy-order");assert.equal(await db.client.count(),1);assert.equal(await db.lead.count(),1);
    assert.equal(await backfillPhones(db),2);assert.equal(await backfillPhones(db),0);assert.equal((await db.client.findUniqueOrThrow({where:{id:"legacy-client"}})).normalizedPhone,"+381641234567");
  }finally{await db.$disconnect();}
});
