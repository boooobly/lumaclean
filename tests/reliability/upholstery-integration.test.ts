import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {PrismaClient} from '../../src/generated/prisma/client';
import {PrismaPg} from '@prisma/adapter-pg';
import {deliverNotification} from '../../src/lib/agent/notifications';
const url = process.env.RELIABILITY_TEST_DATABASE_URL;
const base = process.env.RELIABILITY_TEST_BASE_URL;

test('upholstery: actual HTTP and PostgreSQL preserve one Lead and outbox across concurrent retries', {skip: !url || !base}, async () => {
  assert.equal(new URL(url!).hostname, '127.0.0.1');
  assert.equal(new URL(url!).pathname, '/lumaclean_reliability_test');
  assert.equal(new URL(base!).hostname, '127.0.0.1');
  assert(!process.env.TELEGRAM_BOT_TOKEN, 'HTTP server and test process must use delivery-disabled isolation');
  const db = new PrismaClient({adapter: new PrismaPg({connectionString: url!, max: 4})});
  try {
    await db.user.upsert({where:{email:'release-upholstery@example.test'},create:{id:'release-upholstery-admin',name:'Synthetic release admin',email:'release-upholstery@example.test',role:'ADMIN'},update:{}});
    for (const locale of ['ru','sr','en']) {
      await db.rateLimit.deleteMany({where:{key:{contains:'upholstery-lead'}}});
      const input = {submissionId:randomUUID(),name:'TEST isolated release',phone:'+381601234567',locale,consent:true,comment:'Synthetic isolated release. Do not contact.',attribution:{source:'google',landing:`/${locale}`},request:{mode:'STANDALONE',urgent:false,items:[{type:'SOFA3',quantity:1,soil:'NORMAL',fabric:'UNKNOWN',size:'standard',material:'',notes:''}]}};
      const post = (value: unknown) => fetch(`${base}/api/upholstery/lead`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});
      const results = await Promise.all([post(input),post(input),post(input)]);
      assert.deepEqual(results.map(r=>r.status),[200,200,200]);
      const bodies = await Promise.all(results.map(r=>r.json()));
      assert(bodies.every(b=>b.result.reference===bodies[0].result.reference));
      assert.equal(await db.lead.count({where:{submissionId:input.submissionId}}),1);
      const lead = await db.lead.findUniqueOrThrow({where:{submissionId:input.submissionId}});
      assert.equal(Number(lead.estimatedPrice),4600);
      assert.equal(lead.entrySource,'google'); assert.equal(lead.landingPage,`/${locale}`);
      assert.equal(lead.humanReviewRequired,true);
      const events = await db.notification.findMany({where:{eventKey:`website-lead:${lead.id}:telegram`}});
      assert.equal(events.length,1);
      const changedRetry=await post({...input,name:'Changed retry'});
      assert.equal(changedRetry.status,400);
      assert.match((await changedRetry.json()).error,/другими условиями/);
      // Real DB worker and leases; only the external Telegram transport is injected.
      let calls=0;
      await assert.rejects(deliverNotification(db,events[0].id,async()=>{calls++;return {status:'FAILED',errorCode:'TELEGRAM_RATE_LIMIT',retryable:true};}),/NOTIFICATION_RETRY/);
      assert.equal(await db.lead.count({where:{id:lead.id}}),1,'Transport failure cannot lose a committed Lead');
      assert.equal((await db.notification.findUniqueOrThrow({where:{id:events[0].id}})).deliveryState,'PENDING');
      assert.equal(calls,1);
      await db.notification.update({where:{id:events[0].id},data:{scheduledAt:new Date(0),nextAttemptAt:new Date(0)}});
      await deliverNotification(db,events[0].id,async()=>{calls++;return {status:'DELIVERED',externalMessageId:'synthetic-only'};});
      await deliverNotification(db,events[0].id,async()=>{assert.fail('A delivered notification must not be sent again');});
      assert.equal(calls,2);
      assert.equal((await db.notification.findUniqueOrThrow({where:{id:events[0].id}})).deliveryState,'DELIVERED');
    }
  } finally {await db.$disconnect();}
});
