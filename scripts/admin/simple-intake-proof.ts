import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {hashPassword} from 'better-auth/crypto';
import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from '../../src/generated/prisma/client';
import {pgConnectionString} from '../../src/lib/database/connection';
import {saveWebsiteLead} from '../../src/lib/services/website-leads';
import {websiteLeadSchema} from '../../src/lib/validation/crm';
import {deliverNotification} from '../../src/lib/agent/notifications';
import {executeAgentTool,type ToolContext} from '../../src/lib/agent/tools';
import {effectiveMode} from '../../src/lib/agent/readiness';
import {quote} from '../../src/lib/domain/crm-pricing';
assert(new URL(process.env.DATABASE_URL!).hostname.startsWith('ep-wispy-river-b8xwqy9q'),'Isolated Preview only');
const db=new PrismaClient({adapter:new PrismaPg({connectionString:pgConnectionString(process.env.DATABASE_URL!),max:6})});
const path='qa-output/simple-intake-fixtures.json';
type Manifest={prefix:string;userId:string;email:string;password:string;conversationIds:string[];leadIds:string[]};
async function main(){
 if(process.argv[2]==='clean'){
  const m:Manifest=JSON.parse(readFileSync(path,'utf8'));assert(m.prefix.startsWith('simple-intake-proof:'));
  const leads=await db.lead.findMany({where:{OR:[{id:{in:m.leadIds}},{name:{startsWith:m.prefix}}]},select:{id:true}}),ids=leads.map(l=>l.id);
  assert.equal(await db.order.count({where:{leadId:{in:ids}}}),0);
  await db.notification.deleteMany({where:{OR:[{eventKey:{in:ids.map(id=>`website-lead:${id}:telegram`)}},{conversationId:{in:m.conversationIds}}]}});
  await db.humanHandoff.deleteMany({where:{conversationId:{in:m.conversationIds}}});await db.agentJob.deleteMany({where:{conversationId:{in:m.conversationIds}}});await db.message.deleteMany({where:{conversationId:{in:m.conversationIds}}});await db.conversation.deleteMany({where:{id:{in:m.conversationIds}}});await db.leadExtra.deleteMany({where:{leadId:{in:ids}}});await db.lead.deleteMany({where:{id:{in:ids}}});
  await db.session.deleteMany({where:{userId:m.userId}});await db.account.deleteMany({where:{userId:m.userId}});await db.user.update({where:{id:m.userId},data:{active:false}});console.log({cleaned:true,leads:ids.length});return;
 }
 const settings=await db.businessSettings.findUniqueOrThrow({where:{id:'default'}}),modes={mode:settings.aiAgentMode,channels:settings.aiChannelModes},orders=JSON.stringify(await db.order.findMany({orderBy:{id:'asc'}}));
 const userId=randomUUID(),m:Manifest={prefix:'simple-intake-proof:'+randomUUID(),userId,email:`${userId}@example.test`,password:randomUUID()+'Aa!7',conversationIds:[],leadIds:[]};
 const save=()=>writeFileSync(path,JSON.stringify(m,null,2));save();
 await db.user.create({data:{id:userId,email:m.email,name:'Simple intake Preview verifier',role:'ADMIN',emailVerified:true,accounts:{create:{accountId:userId,providerId:'credential',password:await hashPassword(m.password)}}}});
 let checks=0;const ok=(v:unknown)=>{assert(v);checks++;};
 const base={name:m.prefix+' Test',phone:'+381640000000',locale:'ru',consent:true,attribution:{source:'internal',landing:'/ru/himchistka-mebeli'}};
 for(const kind of ['CLEANING','CLEANING_UPHOLSTERY','UPHOLSTERY']){
  const input={...base,submissionId:randomUUID(),requestKind:kind,upholsteryRequested:kind!=='CLEANING',...(kind==='UPHOLSTERY'?{}:{service:'deep',area:60,urgent:false,extras:[]})};
  const result=await Promise.all([saveWebsiteLead(db,input),saveWebsiteLead(db,input)]);ok(result[0].id===result[1].id);ok(result.filter(r=>r.created).length===1);m.leadIds.push(result[0].id);save();
  const lead=await db.lead.findUniqueOrThrow({where:{id:result[0].id},include:{extras:true}});ok(lead.requestKind===kind);ok(lead.upholsteryRequested===(kind!=='CLEANING'));ok(lead.humanReviewRequired===(kind!=='CLEANING'));ok(!!lead.consentAt);ok(lead.upholsteryQuote===null);ok(lead.comment===null);ok(lead.entrySource==='internal');
  const event=await db.notification.findUnique({where:{eventKey:`website-lead:${lead.id}:telegram`}});ok(!!event===(kind!=='CLEANING'));
  if(kind==='UPHOLSTERY'){ok(lead.area===null&&lead.estimatedPrice===null&&lead.estimateText===null);ok(lead.extras.length===0);}
  else{ok(Number(lead.estimatedPrice)===quote('deep',60,[],false).total);ok(Number(lead.area)===60);}
  await assert.rejects(()=>saveWebsiteLead(db,{...input,name:m.prefix+' Different'}));checks++;
  if(kind==='CLEANING'){
   const {requestKind,upholsteryRequested,...legacy}=websiteLeadSchema.parse(input);void requestKind;void upholsteryRequested;ok(lead.submissionHash===createHash('sha256').update(JSON.stringify(legacy)).digest('hex'));
  }
  if(event){
   if(kind==='CLEANING_UPHOLSTERY'){await assert.rejects(()=>deliverNotification(db,event.id,async()=>({status:'FAILED',errorCode:'TELEGRAM_RATE_LIMIT'})));checks++;ok((await db.notification.findUniqueOrThrow({where:{id:event.id}})).deliveryState==='PENDING');ok(!!await db.lead.findUnique({where:{id:lead.id}}));await db.notification.update({where:{id:event.id},data:{nextAttemptAt:null}});}
   let sends=0;await deliverNotification(db,event.id,async(_thread,text)=>{sends++;ok(text.includes('требуется уточнение'));if(kind==='UPHOLSTERY')ok(!text.includes('Расчёт уборки'));return{status:'DELIVERED',externalMessageId:'test-1'};});await deliverNotification(db,event.id,async()=>{sends++;return{status:'DELIVERED'};});ok(sends===1);ok((await db.lead.findUniqueOrThrow({where:{id:lead.id}})).telegramStatus==='SENT');
  }
 }
 await assert.rejects(()=>saveWebsiteLead(db,{...base,submissionId:randomUUID(),requestKind:'UPHOLSTERY',phone:'abcdef'}));checks++;
 process.env.AI_AGENT_ENABLED='true';
 for(const [locale,text] of [['ru','Нужна химчистка дивана'],['sr-Latn','Treba mi pranje tepiha'],['en','I need upholstery cleaning']]){
  const c=await db.conversation.create({data:{channel:'WEBSITE',locale,state:{},control:'AI_CONTROL'}});m.conversationIds.push(c.id);save();
  const message=await db.message.create({data:{conversationId:c.id,author:'CLIENT',text}}),leaseKey=randomUUID(),job=await db.agentJob.create({data:{conversationId:c.id,messageId:message.id,status:'RUNNING',leaseKey,leaseUntil:new Date(Date.now()+180000)}});
  const ctx:ToolContext={conversationId:c.id,jobId:job.id,leaseKey,revision:c.revision,mode:effectiveMode(settings,'WEBSITE'),state:{}};
  const marked=await executeAgentTool(db,ctx,'markUpholsteryInquiry',{evidence:text});ok(!marked.error);ok(marked.autonomousBooking===false);ok(await db.humanHandoff.count({where:{conversationId:c.id,resolvedAt:null}})===1);ok(await db.notification.count({where:{conversationId:c.id,kind:'HANDOFF_TELEGRAM'}})===1);
  ok((await executeAgentTool(db,ctx,'requestCustomerInput',{intent:'AREA'})).error==='UPHOLSTERY_MANAGER_INTAKE');ok((await executeAgentTool(db,ctx,'estimateDuration',{})).error==='UPHOLSTERY_REVIEW_REQUIRED');ok((await executeAgentTool(db,ctx,'createOrder',{})).error==='UPHOLSTERY_REVIEW_REQUIRED');
  const leadResult=await executeAgentTool(db,ctx,'createOrUpdateLead',{intent:'cleaning',name:m.prefix+' AI',phone:base.phone});ok(!leadResult.error);m.leadIds.push(String(leadResult.leadId));save();const lead=await db.lead.findUniqueOrThrow({where:{id:String(leadResult.leadId)}});ok(lead.requestKind==='UPHOLSTERY'&&lead.upholsteryRequested&&lead.humanReviewRequired);ok(lead.area===null&&lead.estimatedPrice===null);
  await db.agentJob.update({where:{id:job.id},data:{status:'DONE',leaseKey:null,leaseUntil:null}});
 }
 const after=await db.businessSettings.findUniqueOrThrow({where:{id:'default'}});ok(JSON.stringify(modes)===JSON.stringify({mode:after.aiAgentMode,channels:after.aiChannelModes}));ok(orders===JSON.stringify(await db.order.findMany({orderBy:{id:'asc'}})));
 writeFileSync('qa-output/simple-intake-db-proof.json',JSON.stringify({passed:true,checks,modesPreserved:true,ordersUnchanged:true,productionOrdersCreated:0},null,2));console.log({passed:true,checks,modesPreserved:true,ordersUnchanged:true});
}
main().finally(()=>db.$disconnect());
