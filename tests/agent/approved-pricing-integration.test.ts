import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '../../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { pgConnectionString } from '../../src/lib/database/connection';
import { executeAgentTool, json, type ToolContext } from '../../src/lib/agent/tools';
import { effectiveMode } from '../../src/lib/agent/readiness';
import { calculatePrice, serviceIds, extrasPrices } from '../../src/lib/pricing';
import { quote } from '../../src/lib/domain/crm-pricing';
const url=process.env.PRICING_TEST_DATABASE_URL;
test('actual AI tool, active CRM catalogue and public calculator agree', {skip:!url}, async t=>{
  // Dedicated disposable branch cloned for this release; never production.
  assert.equal(new URL(url!).hostname.split('.')[0].replace('-pooler',''),'ep-red-field-b8bc6tfu');
  const db=new PrismaClient({adapter:new PrismaPg({connectionString:pgConnectionString(url!),max:2})});
  const owned:string[]=[];
  try {
    process.env.AI_AGENT_ENABLED='true';
    const settings=await db.businessSettings.findUniqueOrThrow({where:{id:'default'}});
    const mode=effectiveMode(settings,'WEBSITE'); assert.equal(mode,'AUTO');
    const before=await db.order.count();
    const cases=serviceIds.flatMap(service=>[39,40,59,60,79,80,99,100,120].map(area=>({service,area,extras:[] as {code:keyof typeof extrasPrices;quantity:number}[]})));
    for(const [code] of Object.entries(extrasPrices)) cases.push({service:'regular',area:39,extras:[{code:code as keyof typeof extrasPrices,quantity:['ironing','cabinets','standardWindow'].includes(code)?2:1}]});
    cases.push({service:'regular',area:39,extras:[{code:'fridge',quantity:1},{code:'oven',quantity:1}]});
    for (const input of cases) await t.test(`${input.service}/${input.area}/${JSON.stringify(input.extras)}`,async()=>{
      const state={draftFacts:{...input,soilLevel:'NORMAL' as const,extrasConfirmed:true as const}};
      const c=await db.conversation.create({data:{channel:'WEBSITE',locale:'ru',externalThreadId:'pricing-test:'+randomUUID(),state:json(state)}});owned.push(c.id);
      const m=await db.message.create({data:{conversationId:c.id,author:'CLIENT',text:'Сколько стоит?'}}),leaseKey=randomUUID();
      const job=await db.agentJob.create({data:{conversationId:c.id,messageId:m.id,status:'RUNNING',leaseKey,leaseUntil:new Date(Date.now()+300000)}});
      const ctx:ToolContext={conversationId:c.id,jobId:job.id,leaseKey,revision:0,mode,state};
      const result=await executeAgentTool(db,ctx,'calculatePrice',{...input,soilLevel:'NORMAL',urgent:false});
      if(!settings.aiAllowedServices.includes(input.service)){assert.equal(result.error,'UNSUPPORTED_SERVICE');return;}
      assert.equal(result.error,undefined,JSON.stringify(result));
      const publicQuote=calculatePrice(input.service,input.area,input.extras,false);
      assert.equal(result.total,publicQuote.total);assert.equal(result.base,publicQuote.base);
      assert.deepEqual(quote(input.service,input.area,input.extras,false),publicQuote);
      const rows=await db.serviceExtra.findMany({where:{code:{in:input.extras.map(e=>e.code)}}});
      for(const row of rows)assert.equal(Number(row.unitPrice),extrasPrices[row.code as keyof typeof extrasPrices]);
      const live=await db.conversation.findUniqueOrThrow({where:{id:c.id}});
      assert.equal(live.orderId,null);
      const lead=await db.lead.findUniqueOrThrow({where:{id:live.leadId!}});assert.equal(Number(lead.estimatedPrice),publicQuote.total);
    });
    assert.equal(await db.order.count(),before);
  } finally {
    for(const id of owned) await db.$transaction(async tx=>{
      const c=await tx.conversation.findUniqueOrThrow({where:{id}});assert(c.externalThreadId?.startsWith('pricing-test:'));assert.equal(c.orderId,null);
      await tx.agentToolTrace.deleteMany({where:{conversationId:id}});
      await tx.agentJob.deleteMany({where:{conversationId:id}});await tx.message.deleteMany({where:{conversationId:id}});await tx.conversation.delete({where:{id}});
      if(c.leadId){await tx.leadExtra.deleteMany({where:{leadId:c.leadId}});await tx.lead.delete({where:{id:c.leadId}});}
    });
    await db.$disconnect();
  }
});
