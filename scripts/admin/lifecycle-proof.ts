import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {hashPassword} from 'better-auth/crypto';
import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient,type Lead} from '../../src/generated/prisma/client';
import {pgConnectionString} from '../../src/lib/database/connection';
import {runCrmCommand} from '../../src/lib/services/crm-commands';
import {runSchedulingCommand} from '../../src/lib/services/scheduling-commands';
import {localInstant,localInput,CrmError} from '../../src/lib/domain/crm';
import {SchedulingError} from '../../src/lib/domain/scheduling-types';
assert(new URL(process.env.DATABASE_URL!).hostname.startsWith('ep-wispy-river-b8xwqy9q'),'Isolated Preview only');
const db=new PrismaClient({adapter:new PrismaPg({connectionString:pgConnectionString(process.env.DATABASE_URL!),max:6})});
const manifest='qa-output/lifecycle-fixtures.json';
async function main(){
 if(process.argv[2]==='ui-reset'){
  const m=JSON.parse(readFileSync(manifest,'utf8'));assert(m.prefix.startsWith('lifecycle-proof:'));
  const client=await db.client.findUniqueOrThrow({where:{id:m.clientId}});assert(client.name.startsWith(m.prefix));
  for(let n=0;n<2;n++){const o=await db.order.findUniqueOrThrow({where:{id:m.uiOrderIds[n]}});assert(o.clientId===m.clientId);await db.order.update({where:{id:o.id},data:{status:'SCHEDULED',cancellationReason:null,scheduledStart:localInstant(`2026-10-${13+n}T14:30`)}});}
  await db.lead.update({where:{id:m.leadIds[1]},data:{status:'NEW',lostReason:null}});console.log({ownUiFixturesReset:true});return;
 }
 if(process.argv[2]==='financial'){
  const m=JSON.parse(readFileSync(manifest,'utf8'));assert(m.prefix.startsWith('lifecycle-proof:'));
  const source=await db.order.findUniqueOrThrow({where:{id:m.sourceId},include:{client:true}});assert(source.client.name.startsWith(m.prefix));
  const order=await db.order.findFirst({where:{clientId:m.clientId,reference:{startsWith:'QA-LIFE-PAID-'}}})??await db.order.create({data:{reference:'QA-LIFE-PAID-'+randomUUID().slice(0,6),clientId:m.clientId,addressId:source.addressId,serviceId:source.serviceId,area:55,status:'SCHEDULED',scheduledStart:localInstant('2026-11-01T14:30'),manualDurationMinutes:120,travelBufferMinutes:30,basePrice:14000,finalPrice:12000,priceAdjustment:-2000,priceChangeReason:'Согласованные условия'}});
  const payout=await db.cleanerPayout.findUnique({where:{orderId_cleanerId:{orderId:order.id,cleanerId:m.cleanerId}}})??await db.cleanerPayout.create({data:{orderId:order.id,cleanerId:m.cleanerId,amount:2000,status:'PAID',paidAt:new Date(),appliedPercent:20,basisAmount:10000}});
  if(!await db.expense.findUnique({where:{payoutId:payout.id}}))await db.expense.create({data:{orderId:order.id,payoutId:payout.id,category:'PAYOUT',amount:2000,occurredAt:new Date(),description:'Own Preview paid payout fixture'}});
  const finance=async()=>JSON.stringify([await db.expense.findMany({where:{orderId:order.id}}),await db.cleanerPayout.findMany({where:{orderId:order.id}})]),before=await finance();
  const payload={id:order.id,status:'CANCELLED',reason:'Отказ после оплаты',expectedUpdatedAt:order.updatedAt.toISOString()};await runCrmCommand(db,m.userId,'order-status',payload);await runCrmCommand(db,m.userId,'order-status',payload);
  assert.equal(await finance(),before);assert.equal(String((await db.order.findUniqueOrThrow({where:{id:order.id}})).finalPrice),'12000');assert.equal(await db.auditLog.count({where:{entityId:order.id,action:'ORDER_CANCELLED'}}),1);
  writeFileSync('qa-output/lifecycle-financial-proof.json',JSON.stringify({passed:true,paidPayoutPreserved:true,linkedExpensePreserved:true,pricePreserved:true,oneCancellationAudit:true}));console.log({financialPreservation:true});return;
 }
 if(process.argv[2]==='clean'){
  const m=JSON.parse(readFileSync(manifest,'utf8'));assert(m.prefix.startsWith('lifecycle-proof:'));
  const client=await db.client.findUniqueOrThrow({where:{id:m.clientId}});assert(client.name.startsWith(m.prefix));
  const ids=(await db.order.findMany({where:{clientId:m.clientId},select:{id:true}})).map(o=>o.id);assert(ids.length>=3&&ids.length<=6);
  await db.$transaction(async tx=>{
   await tx.notification.deleteMany({where:{OR:[{orderId:{in:ids}},{eventKey:{in:m.leadIds.map((id:string)=>`website-lead:${id}:telegram`)}}]}});
   await tx.expense.deleteMany({where:{orderId:{in:ids}}});await tx.cleanerPayout.deleteMany({where:{orderId:{in:ids}}});
   await tx.schedulingOverride.deleteMany({where:{orderId:{in:ids}}});await tx.orderCleaner.deleteMany({where:{orderId:{in:ids}}});await tx.orderExtra.deleteMany({where:{orderId:{in:ids}}});
   await tx.order.updateMany({where:{id:{in:ids}},data:{repeatSeriesId:null}});await tx.orderRepeatSeries.deleteMany({where:{sourceOrderId:{in:ids}}});await tx.order.deleteMany({where:{id:{in:ids}}});
   await tx.lead.deleteMany({where:{id:{in:m.leadIds}}});await tx.clientAddress.deleteMany({where:{clientId:m.clientId}});await tx.client.delete({where:{id:m.clientId}});await tx.cleaner.delete({where:{id:m.cleanerId}});
   await tx.session.deleteMany({where:{userId:m.userId}});await tx.account.deleteMany({where:{userId:m.userId}});await tx.user.update({where:{id:m.userId},data:{active:false}});
  });console.log({ownFixturesCleaned:true,orders:ids.length,auditRetained:true});return;
 }
 const prefix='lifecycle-proof:'+randomUUID(),userId=randomUUID(),email=randomUUID()+'@example.test',password=randomUUID()+'Aa7!';
 const settings=await db.businessSettings.findUniqueOrThrow({where:{id:'default'}}),modes=JSON.stringify([settings.aiAgentMode,settings.aiChannelModes]);
 const historicalOrders=JSON.stringify(await db.order.findMany({orderBy:{id:'asc'}}));
 await db.user.create({data:{id:userId,name:'Lifecycle Preview verifier',email,emailVerified:true,role:'ADMIN',accounts:{create:{providerId:'credential',accountId:userId,password:await hashPassword(password)}}}});
 const client=await db.client.create({data:{name:prefix+' Клиент',phone:'+381640000000'}});
 const address=await db.clientAddress.create({data:{clientId:client.id,fullAddress:'Preview Beograd',latitude:44.817,longitude:20.46,coordinatesConfirmed:true}});
 const cleaner=await db.cleaner.create({data:{name:prefix+' Клинер',phone:'+381640000000',homeAddress:'Dorćol, Beograd',homeLatitude:44.817,homeLongitude:20.46,homeCoordinatesConfirmed:true,languages:['ru'],skills:['regular'],availability:{create:Array.from({length:7},(_,i)=>({kind:'WEEKLY' as const,weekday:i+1,startMinute:0,endMinute:1440}))}}});
 const service=await db.service.findUniqueOrThrow({where:{code:'regular'}});
 const create=async(day:string,label:string)=>db.order.create({data:{reference:'QA-LIFE-'+label+'-'+randomUUID().slice(0,6),clientId:client.id,addressId:address.id,serviceId:service.id,area:55,status:'SCHEDULED',scheduledStart:localInstant(day+'T14:30'),scheduledEnd:localInstant(day+'T16:30'),manualDurationMinutes:120,durationOverrideReason:'Preview approved duration',cleaningReserveMinutes:15,travelBufferMinutes:30,basePrice:14000,finalPrice:12000,priceAdjustment:-2000,priceChangeReason:'Индивидуальные условия',assignments:{create:{cleanerId:cleaner.id,acceptedAt:new Date()}}}});
 const source=await create('2026-10-13','SOURCE'),sibling=await create('2026-10-16','SIBLING'),conflict=await create('2026-10-20','CONFLICT');
 const series=await db.orderRepeatSeries.create({data:{requestId:randomUUID(),requestHash:'lifecycle-proof',sourceOrderId:source.id,template:{test:true},weekly:true,weekdays:[2,5],endsOn:new Date('2026-11-06')}});
 await db.order.updateMany({where:{id:{in:[source.id,sibling.id]}},data:{repeatSeriesId:series.id}});
 const leads:Lead[]=[];for(let n=0;n<2;n++)leads.push(await db.lead.create({data:{name:prefix+' Заявка '+n,phone:'+381640000000',reference:'QA-LIFE-LEAD-'+n,clientId:client.id,channel:'MANUAL',comment:'Сохранить комментарий'}}));
 const m={prefix,userId,email,password,clientId:client.id,cleanerId:cleaner.id,sourceId:source.id,siblingId:sibling.id,conflictId:conflict.id,seriesId:series.id,leadIds:leads.map(l=>l.id),uiOrderIds:[] as string[]};const save=()=>writeFileSync(manifest,JSON.stringify(m,null,2));save();
 let checks=0;const ok=(value:unknown)=>{assert(value);checks++;};
 const current=await db.order.findUniqueOrThrow({where:{id:source.id}}),siblingBefore=JSON.stringify(await db.order.findUnique({where:{id:sibling.id}}));
 const plan=(start:string,version=current.updatedAt.toISOString())=>runSchedulingCommand(db,userId,'order-plan',{id:source.id,expectedUpdatedAt:version,scheduledStart:start,manualDurationMinutes:120,durationOverrideReason:'Preview approved duration',cleanerIds:[cleaner.id],status:'SCHEDULED',source:'EDITOR',acknowledged:[],overrideReason:null});
 await assert.rejects(()=>plan('2026-10-20T14:30'),SchedulingError);checks++;
 ok((await db.order.findUniqueOrThrow({where:{id:source.id}})).scheduledStart?.toISOString()===current.scheduledStart?.toISOString());
 await plan('2026-10-27T14:30');const moved=await db.order.findUniqueOrThrow({where:{id:source.id}});ok(localInput(moved.scheduledStart)==='2026-10-27T14:30');ok(moved.id===source.id);ok(String(moved.finalPrice)==='12000');ok(String(moved.basePrice)==='14000');ok(moved.priceChangeReason===current.priceChangeReason);ok(moved.repeatSeriesId===series.id);ok(JSON.stringify(await db.order.findUnique({where:{id:sibling.id}}))===siblingBefore);
 await assert.rejects(()=>runCrmCommand(db,userId,'order-status',{id:source.id,status:'CANCELLED',reason:'Отказ',expectedUpdatedAt:current.updatedAt.toISOString()}),(e:unknown)=>e instanceof CrmError&&e.code==='STALE');checks++;
 await assert.rejects(()=>runCrmCommand(db,userId,'order-status',{id:source.id,status:'CANCELLED',reason:null}));checks++;
 const cancel={id:source.id,status:'CANCELLED',reason:'Клиент отказался',expectedUpdatedAt:moved.updatedAt.toISOString()};await Promise.all([runCrmCommand(db,userId,'order-status',cancel),runCrmCommand(db,userId,'order-status',cancel)]);
 const cancelled=await db.order.findUniqueOrThrow({where:{id:source.id}});ok(cancelled.status==='CANCELLED');ok(cancelled.cancellationReason===cancel.reason);ok(String(cancelled.finalPrice)==='12000');ok(cancelled.completedAt===null);ok(await db.auditLog.count({where:{entityId:source.id,action:'ORDER_CANCELLED'}})===1);ok(JSON.stringify(await db.order.findUnique({where:{id:sibling.id}}))===siblingBefore);ok((await db.orderRepeatSeries.findUniqueOrThrow({where:{id:series.id}})).stoppedAt===null);
 const financialBefore=JSON.stringify([await db.expense.findMany({where:{orderId:source.id}}),await db.cleanerPayout.findMany({where:{orderId:source.id}})]);ok(financialBefore==='[[],[]]');
 const lost={id:leads[0].id,status:'LOST',reason:'Клиент отказался',expectedUpdatedAt:leads[0].updatedAt.toISOString()};await Promise.all([runCrmCommand(db,userId,'lead-status',lost),runCrmCommand(db,userId,'lead-status',lost)]);
 const closed=await db.lead.findUniqueOrThrow({where:{id:leads[0].id}});ok(closed.status==='LOST'&&closed.comment===leads[0].comment&&closed.phone===leads[0].phone);ok(await db.auditLog.count({where:{entityId:closed.id,action:'LEAD_STATUS_CHANGED'}})===1);
 await runCrmCommand(db,userId,'lead-status',{id:closed.id,status:'IN_PROGRESS',expectedUpdatedAt:closed.updatedAt.toISOString()});ok((await db.lead.findUniqueOrThrow({where:{id:closed.id}})).status==='IN_PROGRESS');
 const noted=await db.lead.update({where:{id:leads[1].id},data:{internalNote:'Изменилось'}});await assert.rejects(()=>runCrmCommand(db,userId,'lead-status',{id:noted.id,status:'LOST',reason:'Отказ',expectedUpdatedAt:leads[1].updatedAt.toISOString()}),(e:unknown)=>e instanceof CrmError&&e.code==='STALE');checks++;
 await db.lead.update({where:{id:noted.id},data:{status:'CONVERTED'}});await assert.rejects(()=>runCrmCommand(db,userId,'lead-status',{id:noted.id,status:'LOST',reason:'Отказ'}));checks++;
 await db.lead.update({where:{id:noted.id},data:{status:'NEW'}});
 const uiCancel=await create('2026-10-13','UI-CANCEL'),uiMove=await create('2026-10-14','UI-MOVE');m.uiOrderIds=[uiCancel.id,uiMove.id];save();
 const after=await db.businessSettings.findUniqueOrThrow({where:{id:'default'}});ok(modes===JSON.stringify([after.aiAgentMode,after.aiChannelModes]));ok(historicalOrders===JSON.stringify(await db.order.findMany({where:{clientId:{not:client.id}},orderBy:{id:'asc'}})));
 writeFileSync('qa-output/lifecycle-db-proof.json',JSON.stringify({passed:true,checks,historicalOrdersPreserved:true,channelModesPreserved:true,productionOrdersCreated:0},null,2));console.log({passed:true,checks});
}
main().finally(()=>db.$disconnect());
