import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {PrismaClient} from '../../src/generated/prisma/client';
import {PrismaPg} from '@prisma/adapter-pg';
import {pgConnectionString} from '../../src/lib/database/connection';
import {saveWebsiteLead,notifyWebsiteLead} from '../../src/lib/services/website-leads';
import {websiteLeadSchema} from '../../src/lib/validation/crm';

const url=process.env.WEBSITE_UX_TEST_DATABASE_URL,base=process.env.WEBSITE_UX_TEST_BASE_URL;
test('website conversion: persisted preferences, server prices, retry and historical safety',{skip:!url},async t=>{
  assert.equal(new URL(url!).hostname.split('.')[0].replace('-pooler',''),'ep-red-field-b8bc6tfu');
  const db=new PrismaClient({adapter:new PrismaPg({connectionString:pgConnectionString(url!),max:3})});
  const ids:string[]=[],submissionIds:string[]=[];
  const now=new Date('2026-10-18T10:00:00Z');
  const fixture=(more:Record<string,unknown>={})=>{const submissionId=randomUUID();submissionIds.push(submissionId);return{submissionId,phone:'+381601234567',locale:'ru',service:'regular',area:55,consent:true,comment:'Synthetic UX test '+submissionId,...more};};
  const save=async(input:unknown,time=now)=>{const result=await saveWebsiteLead(db,input,time);if(!ids.includes(result.id))ids.push(result.id);return result;};
  const fingerprints=async()=>({orders:await db.$queryRaw`SELECT count(*)::int AS count,md5(coalesce(string_agg(md5(t::text),'' ORDER BY t::text),'')) AS hash FROM "Order" t`,lines:await db.$queryRaw`SELECT count(*)::int AS count,md5(coalesce(string_agg(md5(t::text),'' ORDER BY t::text),'')) AS hash FROM "OrderExtra" t`});
  try{
    const before=await fingerprints();
    await t.test('phone without name and concurrent double submit produce exactly one Lead',async()=>{
      const input=fixture({preferredDate:'2026-10-19',preferredTime:'MORNING',preferredChannel:'WHATSAPP',urgent:true,extras:[{code:'standardWindow',quantity:2}],attribution:{landing:'/ru',source:'google'}});
      const results=await Promise.all([save(input),save(input),save(input)]);
      assert.equal(new Set(results.map(r=>r.id)).size,1);assert.equal(results.filter(r=>r.created).length,1);
      const lead=await db.lead.findUniqueOrThrow({where:{id:results[0].id},include:{extras:true,orders:true}});
      assert.equal(lead.name,null);assert.equal(lead.preferredDate?.toISOString(),'2026-10-19T00:00:00.000Z');assert.equal(lead.preferredTime,'MORNING');assert.equal(lead.preferredChannel,'WHATSAPP');
      assert.equal(lead.urgent,false);assert.equal(Number(lead.estimatedPrice),7400);assert.equal(Number(lead.extras[0].unitPrice),700);assert.equal(lead.orders.length,0);assert(lead.consentAt);assert.equal(lead.entrySource,'google');
      await assert.rejects(save({...input,preferredDate:'2026-10-20'}),{code:'IDEMPOTENCY'});
      let notification='';const oldToken=process.env.TELEGRAM_BOT_TOKEN,oldChat=process.env.TELEGRAM_CHAT_ID;
      try{process.env.TELEGRAM_BOT_TOKEN='synthetic';process.env.TELEGRAM_CHAT_ID='synthetic';await notifyWebsiteLead(db,results[0],websiteLeadSchema.parse(input),(async(_url,options)=>{notification=JSON.parse(String(options?.body)).text;return new Response('{"ok":true}',{status:200});}) as typeof fetch);}
      finally{if(oldToken===undefined)delete process.env.TELEGRAM_BOT_TOKEN;else process.env.TELEGRAM_BOT_TOKEN=oldToken;if(oldChat===undefined)delete process.env.TELEGRAM_CHAT_ID;else process.env.TELEGRAM_CHAT_ID=oldChat;}
      assert(notification.includes('2026-10-19'));assert(notification.includes('Утро'));assert(notification.includes('не подтверждённая бронь'));
    });
    await t.test('no date is allowed; deep and windows retain authoritative prices',async()=>{
      const saved=await save(fixture({service:'deep',extras:[{code:'standardWindow',quantity:2}]}));
      const lead=await db.lead.findUniqueOrThrow({where:{id:saved.id}});assert.equal(lead.preferredDate,null);assert.equal(lead.urgent,false);assert.equal(Number(lead.estimatedPrice),12800);
    });
    await t.test('same-day is derived by server and cutoff is enforced',async()=>{
      const saved=await save(fixture({preferredDate:'2026-10-18',urgent:false}));
      const lead=await db.lead.findUniqueOrThrow({where:{id:saved.id}});assert.equal(lead.urgent,true);assert.equal(Number(lead.estimatedPrice),7200);
      await assert.rejects(save(fixture({preferredDate:'2026-10-18'}),new Date('2026-10-18T15:00:00Z')),{message:'SAME_DAY_CUTOFF'});
      await assert.rejects(save(fixture({preferredDate:'2026-10-17'})),{message:'PAST_SERVICE_DATE'});
    });
    await t.test('heavy soiling and upholstery are enquiries, with no invented full price or Orders',async()=>{
      const heavy=await save(fixture({soilLevel:'HEAVY'}));const h=await db.lead.findUniqueOrThrow({where:{id:heavy.id}});assert.equal(h.estimatedPrice,null);assert.equal(h.humanReviewRequired,true);
      const input=fixture({requestKind:'UPHOLSTERY',upholsteryRequested:true});delete (input as Record<string,unknown>).service;delete (input as Record<string,unknown>).area;
      const upholstery=await save(input);const u=await db.lead.findUniqueOrThrow({where:{id:upholstery.id}});assert.equal(u.estimatedPrice,null);assert.equal(u.name,null);assert.equal(u.humanReviewRequired,true);
      await assert.rejects(save(fixture({phone:'123456789'})),{message:'INVALID_PHONE'});
      await assert.rejects(save(fixture({consent:false})));
    });
    await t.test('real local HTTP endpoint accepts optional name and structured date without duplicates',{skip:!base},async()=>{
      assert.equal(new URL(base!).hostname,'localhost');
      const policy=await fetch(`${base}/api/booking-policy`).then(r=>r.json());assert.equal(policy.timezone,'Europe/Belgrade');assert(policy.today);
      const next=new Date(new Date(`${policy.today}T12:00:00Z`).getTime()+86400000).toISOString().slice(0,10);
      const input=fixture({preferredDate:next,preferredTime:'EVENING',preferredChannel:'VIBER',locale:'en'});
      const post=()=>fetch(`${base}/api/lead`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)}).then(async r=>({status:r.status,body:await r.json()}));
      const [a,b]=await Promise.all([post(),post()]);assert.equal(a.status,200);assert.equal(b.status,200);assert.equal(a.body.reference,b.body.reference);assert.match(a.body.reference,/^LC-/);
      const lead=await db.lead.findUniqueOrThrow({where:{submissionId:input.submissionId}});ids.push(lead.id);assert.equal(lead.name,null);assert.equal(lead.preferredDate?.toISOString().slice(0,10),next);assert.equal(lead.preferredTime,'EVENING');
      const invalid=await fetch(`${base}/api/lead`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(fixture({consent:false}))});assert.equal(invalid.status,400);
    });
    assert.deepEqual(await fingerprints(),before);
  }finally{
    // Only our unique synthetic submissions, on this isolated branch.
    const rows=await db.lead.findMany({where:{submissionId:{in:submissionIds}},select:{id:true}});
    for(const {id} of rows)await db.$transaction(async tx=>{
      assert.equal(await tx.order.count({where:{leadId:id}}),0);
      await tx.notification.deleteMany({where:{eventKey:`website-lead:${id}:telegram`}});
      // AuditLog is append-only: retain the test creation audit, too.
      await tx.leadExtra.deleteMany({where:{leadId:id}});await tx.lead.delete({where:{id}});
    });
    await db.$disconnect();
  }
});
