import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {PrismaClient} from '../../src/generated/prisma/client';
import {PrismaPg} from '@prisma/adapter-pg';
import {pgConnectionString} from '../../src/lib/database/connection';
import {saveWebsiteLead} from '../../src/lib/services/website-leads';
import {deliverNotification} from '../../src/lib/agent/notifications';
const url=process.env.HOMEPAGE_TEST_DATABASE_URL;
test('homepage intake: persistence, consent, prices, notification, retry and history',{skip:!url},async t=>{
  assert.equal(new URL(url!).hostname.replace('-pooler',''),'ep-soft-mouse-b8k17i7e.c-14.us-east-1.aws.neon.tech');
  const db=new PrismaClient({adapter:new PrismaPg({connectionString:pgConnectionString(url!),max:3})});const owned:string[]=[];
  const fixture=(extra={})=>({submissionId:randomUUID(),requestKind:'CLEANING',phone:'+381601234567',locale:'ru',consent:true,service:'regular',area:55,...extra});
  const save=async(input:unknown)=>{const r=await saveWebsiteLead(db,input);if(!owned.includes(r.id))owned.push(r.id);return r;};
  const hashes=async()=>{const result:Record<string,unknown>={};for(const table of ['Order','OrderExtra','Client','Expense','CleanerPayout','Investment','BusinessSettings'])result[table]=await db.$queryRawUnsafe(`SELECT count(*)::int AS count,md5(coalesce(string_agg(md5(t::text),'' ORDER BY t::text),'')) AS hash FROM "${table}" t`);return result;};
  try{const before=await hashes();
    for(const locale of ['ru','sr','en'])await t.test(`callback ${locale}: concurrent retries create one genuine contact Lead`,async()=>{
      const input={submissionId:randomUUID(),requestKind:'CONTACT_REQUEST',phone:'+381601234567',consent:true,locale,attribution:{source:'google',landing:`/${locale}`}};
      const results=await Promise.all([save(input),save(input),save(input)]);assert.equal(new Set(results.map(r=>r.id)).size,1);assert.equal(results.filter(r=>r.created).length,1);
      const lead=await db.lead.findUniqueOrThrow({where:{id:results[0].id},include:{extras:true,orders:true}});
      assert.equal(lead.name,null);assert.equal(lead.serviceId,null);assert.equal(lead.area,null);assert.equal(lead.estimatedPrice,null);assert.equal(lead.requestKind,'CONTACT_REQUEST');assert.equal(lead.channel,'WEBSITE');assert.equal(lead.locale,locale);assert(lead.consentAt);assert.equal(lead.entrySource,'google');assert.equal(lead.landingPage,`/${locale}`);assert.equal(lead.extras.length,0);assert.equal(lead.orders.length,0);assert.equal(lead.humanReviewRequired,true);assert.equal(lead.estimateText,null);
      assert.equal(await db.auditLog.count({where:{entityType:'Lead',entityId:lead.id,action:'LEAD_CREATED'}}),1);
      const jobs=await db.notification.findMany({where:{eventKey:`website-lead:${lead.id}:telegram`}});assert.equal(jobs.length,1);assert.match(jobs[0].text,/обратный звонок/);assert(!jobs[0].text.includes('RSD'));
      let sent=0;await deliverNotification(db,jobs[0].id,async(_thread,text)=>{sent++;assert.match(text,/Услуга и площадь пока не указаны/);return{status:'SENT',externalMessageId:'synthetic'};});await deliverNotification(db,jobs[0].id,async()=>{throw Error('Duplicate send');});assert.equal(sent,1);assert.equal((await db.lead.findUniqueOrThrow({where:{id:lead.id}})).telegramStatus,'SENT');
      await assert.rejects(save({...input,phone:'+381601234568'}),{code:'IDEMPOTENCY'});
    });
    await t.test('optional name, two windows and every existing cleaning type use shared prices',async()=>{for(const service of ['regular','deep','move','airbnb','office']){const r=await save(fixture({service,extras:[{code:'standardWindow',quantity:2}]}));const lead=await db.lead.findUniqueOrThrow({where:{id:r.id},include:{extras:true}});assert.equal(lead.name,null);assert.equal(Number(lead.extras[0].unitPrice),700);if(service==='regular')assert.equal(Number(lead.estimatedPrice),7400);if(service==='deep')assert.equal(Number(lead.estimatedPrice),12800);}});
    await t.test('upholstery only needs no apartment area; combined price excludes manual upholstery',async()=>{const only=await save({submissionId:randomUUID(),requestKind:'UPHOLSTERY',phone:'+381601234567',consent:true,locale:'en'});const a=await db.lead.findUniqueOrThrow({where:{id:only.id}});assert.equal(a.area,null);assert.equal(a.estimatedPrice,null);assert.equal(a.humanReviewRequired,true);const combined=await save(fixture({requestKind:'CLEANING_UPHOLSTERY'}));const b=await db.lead.findUniqueOrThrow({where:{id:combined.id}});assert.equal(Number(b.estimatedPrice),6000);assert.equal(b.humanReviewRequired,true);});
    await t.test('bad phone, no consent or invented callback details create nothing',async()=>{const count=await db.lead.count();await assert.rejects(save(fixture({phone:'123456789'})),{message:'INVALID_PHONE'});await assert.rejects(save(fixture({consent:false})));await assert.rejects(save(fixture({requestKind:'CONTACT_REQUEST'})));assert.equal(await db.lead.count(),count);});
    assert.deepEqual(await hashes(),before);
  }finally{for(const id of owned)await db.$transaction(async tx=>{assert.equal(await tx.order.count({where:{leadId:id}}),0);await tx.notification.deleteMany({where:{eventKey:`website-lead:${id}:telegram`}});await tx.leadExtra.deleteMany({where:{leadId:id}});await tx.lead.delete({where:{id}});});await db.$disconnect();}
});
