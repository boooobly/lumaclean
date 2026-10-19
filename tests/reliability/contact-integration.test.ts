import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import test from 'node:test';
import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from '../../src/generated/prisma/client';
import {deliverNotification} from '../../src/lib/agent/notifications';
const url=process.env.RELIABILITY_TEST_DATABASE_URL,base=process.env.RELIABILITY_TEST_BASE_URL;
test('PR23 CONTACT_REQUEST uses the same durable, idempotent, limited intake',{skip:!url||!base},async()=>{
  assert.equal(new URL(url!).hostname,'127.0.0.1');assert.equal(new URL(url!).pathname,'/lumaclean_reliability_test');assert.equal(new URL(base!).hostname,'127.0.0.1');
  const db=new PrismaClient({adapter:new PrismaPg({connectionString:url!,max:3})});
  const post=(input:unknown)=>fetch(`${base}/api/lead`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
  try{
    await db.rateLimit.deleteMany({where:{key:{startsWith:'website-lead:'}}});
    const orders=await db.order.count(),input={submissionId:randomUUID(),phone:'0641234567',locale:'ru',consent:true,requestKind:'CONTACT_REQUEST'};
    const first=await post(input);assert.equal(first.status,200);const result=await first.json();
    const repeat=await post(input);assert.equal(repeat.status,200);assert.equal((await repeat.json()).reference,result.reference);
    const lead=await db.lead.findUniqueOrThrow({where:{submissionId:input.submissionId}});
    for(const key of ['name','serviceId','area','estimatedPrice','estimateText'] as const)assert.equal(lead[key],null,key);
    assert.equal(lead.requestKind,'CONTACT_REQUEST');assert(lead.humanReviewRequired);assert(lead.consentAt);
    const eventKey=`website-lead:${lead.id}:telegram`;assert.equal(await db.notification.count({where:{eventKey}}),1);
    const n=await db.notification.findUniqueOrThrow({where:{eventKey}});assert(n.text.includes('Обратный звонок'));
    await deliverNotification(db,n.id,async()=>({status:'DELIVERED',externalMessageId:'synthetic-contact-receipt'}));
    await deliverNotification(db,n.id,async()=>assert.fail('No duplicate confirmed contact notification'));
    assert.equal((await db.lead.findUniqueOrThrow({where:{id:lead.id}})).telegramStatus,'SENT');
    const optionalName=await post({submissionId:randomUUID(),phone:'0641234567',locale:'ru',consent:true,service:'regular',area:55});assert.equal(optionalName.status,200);
    const bulk=await Promise.all(Array.from({length:19},()=>post({...input,submissionId:randomUUID()})));assert.equal(bulk.filter(r=>r.status===429).length,1);
    assert.equal((await post(input)).status,200);assert.equal(await db.order.count(),orders);
  }finally{await db.$disconnect();}
});
