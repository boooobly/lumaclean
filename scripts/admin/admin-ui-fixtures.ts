import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import assert from 'node:assert/strict';
import { Temporal } from '@js-temporal/polyfill';
import { PrismaClient } from '../../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { pgConnectionString } from '../../src/lib/database/connection';
import { runInboxCommand } from '../../src/lib/agent/inbox';
import { conversationData, inboxData } from '../../src/lib/agent/queries';

const url = process.env.DATABASE_URL!;
assert(new URL(url).hostname.startsWith('ep-wispy-river-b8xwqy9q'), 'Only the existing isolated Preview database is allowed');
const db = new PrismaClient({adapter:new PrismaPg({connectionString:pgConnectionString(url),max:3})});
const path = 'qa-output/ui-fixtures.json';
type Manifest = {prefix:string;conversations:string[];orders:string[];clients:string[];cleaners:string[];leads:string[];baselineMode:string;channels:unknown;checks?:number};
async function main() { try {
 if (process.argv[2] === 'clean') {
  const m:Manifest=JSON.parse(readFileSync(path,'utf8'));
  assert(m.prefix.startsWith('ui-audit:'));
  const owned=await db.conversation.findMany({where:{id:{in:m.conversations}},select:{externalThreadId:true}});
  assert(owned.every(c=>c.externalThreadId?.startsWith(m.prefix)));
  const attachments=await db.chatAttachment.findMany({where:{conversationId:{in:m.conversations}},select:{storageKey:true,thumbnailKey:true}});
  // Storage cleanup uses only records attached to these disposable Preview conversations.
  if(attachments.length){const {PrivateBlobStorage}=await import('../../src/lib/agent/chat-attachments');await new PrivateBlobStorage().remove([...new Set(attachments.flatMap(a=>[a.storageKey,a.thumbnailKey]))]);}
  await db.$transaction(async tx=>{
   const conv={conversationId:{in:m.conversations}}, order={orderId:{in:m.orders}};
   await tx.notification.deleteMany({where:{OR:[{conversationId:{in:m.conversations}},{orderId:{in:m.orders}},{clientId:{in:m.clients}},{cleanerId:{in:m.cleaners}}]}});
   await tx.shadowSuggestion.deleteMany({where:conv});await tx.chatAttachment.deleteMany({where:conv});await tx.agentSlot.deleteMany({where:conv});await tx.agentToolTrace.deleteMany({where:conv});await tx.aIInvocation.deleteMany({where:conv});await tx.agentJob.deleteMany({where:conv});await tx.humanHandoff.deleteMany({where:conv});await tx.message.deleteMany({where:conv});await tx.conversation.deleteMany({where:{id:{in:m.conversations}}});
   // AuditLog is append-only: keep the immutable record of disposable QA actions.
   await tx.expense.deleteMany({where:order});await tx.cleanerPayout.deleteMany({where:order});await tx.schedulingOverride.deleteMany({where:order});await tx.orderCleaner.deleteMany({where:order});await tx.orderExtra.deleteMany({where:order});await tx.order.deleteMany({where:{id:{in:m.orders}}});await tx.leadExtra.deleteMany({where:{leadId:{in:m.leads}}});await tx.lead.deleteMany({where:{id:{in:m.leads}}});await tx.clientAddress.deleteMany({where:{clientId:{in:m.clients}}});await tx.client.deleteMany({where:{id:{in:m.clients}}});await tx.cleanerAvailability.deleteMany({where:{cleanerId:{in:m.cleaners}}});await tx.cleaner.deleteMany({where:{id:{in:m.cleaners}}});
  });
  const settings=await db.businessSettings.findUniqueOrThrow({where:{id:'default'}});
  assert.equal(settings.aiAgentMode,m.baselineMode);assert.deepEqual(settings.aiChannelModes,m.channels);
  console.log({cleaned:m.conversations.length+m.orders.length+m.clients.length+m.cleaners.length+m.leads.length,remaining:await db.conversation.count({where:{externalThreadId:{startsWith:m.prefix}}}),modesPreserved:true});
 } else if(process.argv[2]==='check') {
  const m:Manifest=JSON.parse(readFileSync(path,'utf8')),owner=await db.user.findFirstOrThrow({where:{role:'ADMIN',active:true}}),id=m.conversations[3];
  await runInboxCommand(db,owner.id,{action:'takeover',id});assert.equal((await db.conversation.findUniqueOrThrow({where:{id}})).control,'HUMAN_CONTROL');
  const requestId=randomUUID();for(let i=0;i<2;i++)await runInboxCommand(db,owner.id,{action:'reply',id,requestId,text:'UI test reply'});
  assert.equal(await db.message.count({where:{conversationId:id,author:'ADMIN'}}),1);
  await runInboxCommand(db,owner.id,{action:'resume',id});assert.equal((await db.conversation.findUniqueOrThrow({where:{id}})).control,'AI_CONTROL');
  assert.equal(await db.agentJob.count({where:{conversationId:id}}),0);
  const detail=await conversationData(db,m.conversations[0]);assert(detail?.before);assert.equal(detail.messages.length,200);assert(!detail.messages.filter(x=>x.customerVisible).some(x=>x.text==='Internal tool event'));
  const older=await conversationData(db,m.conversations[0],detail.before!);assert(older?.messages.length);assert(older.messages.every(x=>x.sentAt<detail.messages[0].sentAt));
  const filtered=await inboxData(db,'UNREAD');assert(filtered.rows.some(x=>x.id===m.conversations[1]));assert(!filtered.rows.some(x=>x.id===id));
  const handoffs=await inboxData(db,'TRANSFERRED');assert(handoffs.rows.some(x=>x.id===m.conversations[1]));
  const long=await inboxData(db);assert(long.rows.find(x=>x.id===m.conversations[2])?.failedDelivery);
  m.checks=10;writeFileSync(path,JSON.stringify(m,null,2));console.log({previewIntegrationChecks:10,passed:true});
 } else {
  mkdirSync('qa-output',{recursive:true});assert(!process.argv.includes('--production'));
  if(existsSync(path)){const previous:Manifest=JSON.parse(readFileSync(path,'utf8'));assert.equal(await db.conversation.count({where:{id:{in:previous.conversations}}}),0,'Clean existing fixtures before seeding again');}
  const prefix='ui-audit:'+randomUUID(),baseline=await db.businessSettings.findUniqueOrThrow({where:{id:'default'}});
  const m:Manifest={prefix,conversations:[],orders:[],clients:[],cleaners:[],leads:[],baselineMode:baseline.aiAgentMode,channels:baseline.aiChannelModes};
  const save=()=>writeFileSync(path,JSON.stringify(m,null,2));save();
  const day=Temporal.Now.plainDateISO('Europe/Belgrade'),when=(n:number,hour:number)=>new Date(day.add({days:n}).toZonedDateTime({timeZone:'Europe/Belgrade',plainTime:`${String(hour).padStart(2, "0")}:00`}).epochMilliseconds);
  const client=await db.client.create({data:{name:'QA · Željka Đorđević Petrović — veoma dugačko ime',phone:'+381000000000',notes:'Synthetic Preview UI fixture',addresses:{create:{fullAddress:'QA · Bulevar umetnosti, Novi Beograd, veoma dugačka napomena za ulaz',coordinatesConfirmed:false}}},include:{addresses:true}});m.clients.push(client.id);save();
  const service=await db.service.findFirstOrThrow({where:{active:true}});
  const cleaner=await db.cleaner.create({data:{name:'QA · Клинер с длинным именем',phone:'+381000000001',active:true,languages:['Русский','Srpski'],skills:['Генеральная'],payoutPercent:null,availability:{create:[{kind:'WEEKLY',weekday:day.dayOfWeek,startMinute:480,endMinute:1200}]}}});m.cleaners.push(cleaner.id);save();
  for(const n of [0,1,-1]){const order=await db.order.create({data:{reference:'QA-'+randomUUID().slice(0,8),clientId:client.id,addressId:client.addresses[0].id,serviceId:service.id,area:53,scheduledStart:when(n,9),estimatedDurationMinutes:180,travelBufferMinutes:30,status:n===-1?'COMPLETED':'CONFIRMED',completedAt:n===-1?when(-1,12):null,basePrice:10700,finalPrice:10700,assignments:{create:{cleanerId:cleaner.id}},internalComment:'Synthetic Preview only'}});m.orders.push(order.id);save();}
  const lead=await db.lead.create({data:{reference:'QA-'+randomUUID().slice(0,8),name:client.name,phone:client.phone,channel:'WEBSITE',status:'NEW',serviceId:service.id,area:53,estimatedPrice:10700,comment:'Treba nam detaljno čišćenje prozora, kuhinje, kupatila i balkona. '.repeat(8),telegramStatus:'CANCELLED'}});m.leads.push(lead.id);save();
  for(let i=0;i<5;i++){
   const c=await db.conversation.create({data:{channel:i===2?'WHATSAPP':'WEBSITE',externalThreadId:`${prefix}:${i}`,clientId:i===0?client.id:null,orderId:i===0?m.orders[0]:null,state:{name:i===2?undefined:i===1?'QA · Handoff':i===4?'QA · Пустой диалог':i===3?'QA · SHADOW':client.name,phone:'+381000000000'},control:i===0?'HUMAN_CONTROL':'AI_CONTROL',unreadCount:i===1?4:0,needsAttention:i===1||i===2,shadowProposal:i===3?{text:'Predlog: možemo dogovoriti čišćenje kada vam odgovara.',plan:[],at:new Date().toISOString(),stage:'DISCOVERY'}:undefined,lastMessageAt:new Date(Date.now()+i*1000)}});m.conversations.push(c.id);save();
   if(i===0){await db.message.createMany({data:Array.from({length:225},(_,j)=>({conversationId:c.id,author:j%3===0?'CLIENT' as const:j%3===1?'AI' as const:'ADMIN' as const,text:j===224?'Ovo je dugačka poruka na srpskom jeziku. '.repeat(30):`QA poruka ${j+1} · čišćenje stana`,sentAt:new Date(Date.now()-(225-j)*60000),deliveryStatus:j%3===0?'DELIVERED':j%3===1?'READ':'SENT'}))});await db.message.create({data:{conversationId:c.id,author:'SYSTEM',text:'Internal tool event'}});}
   if(i===1){await db.humanHandoff.create({data:{conversationId:c.id,reason:'COMPLAINT'}});await db.message.create({data:{conversationId:c.id,author:'CLIENT',text:'Нужен оператор, пожалуйста.'}});}
   if(i===2)await db.message.create({data:{conversationId:c.id,author:'ADMIN',text:'Не доставлено — synthetic UI fixture',deliveryStatus:'UNKNOWN',deliveryError:'DELIVERY_OUTCOME_UNKNOWN'}});
  }
  console.log({fixtureManifest:path,conversations:m.conversations,orders:m.orders,client:client.id,cleaner:cleaner.id,lead:lead.id});
 }
} finally {await db.$disconnect();} }
void main().catch(error=>{console.error(error);process.exitCode=1;});
