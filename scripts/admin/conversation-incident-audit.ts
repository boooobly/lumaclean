// Exact incident lookup; production transaction is read-only. Reports exclude IDs and PII.
import {Client} from 'pg';
import {writeFileSync} from 'node:fs';
import {pgConnectionString} from '../../src/lib/database/connection';
const url=process.env.DATABASE_URL;
if(!url||!new URL(url).hostname.startsWith('ep-bitter-mode-b8r8ruag'))throw Error('PRODUCTION_READ_ONLY_REQUIRED');
const db=new Client({connectionString:pgConnectionString(url)});
const supplied=['Здравствуйте, хочу заказать клининг','Обычная уборка','88','Да, мне нужно холодильник помыть и духовку. Сколько это всё будет стоить?','Обычное загрязнение','Да, я же написал'];
const safeFacts=(v:Record<string,unknown>|undefined)=>Object.fromEntries(Object.entries(v??{}).filter(([k])=>['service','area','soilLevel','extras','extrasConfirmed','declinedExtras','bathroomCount','windowCleaning','requestedDate'].includes(k)));
async function main(){
 await db.connect();await db.query('BEGIN READ ONLY');await db.query("SET LOCAL statement_timeout='30s'");
 const found=await db.query('SELECT DISTINCT "conversationId" FROM "Message" WHERE author=$1 AND (text=$2 OR text ILIKE $3)', ['CLIENT',supplied[3],'%холодильник помыть и духовку%']);
 const incidents=[];
 for(const [index,row] of found.rows.entries()){
  const id=row.conversationId;
  const c=(await db.query('SELECT state,revision,control,stage,"leadId" FROM "Conversation" WHERE id=$1',[id])).rows[0];
  const messages=await db.query('SELECT id,author,text,"sentAt",structured FROM "Message" WHERE "conversationId"=$1 ORDER BY "sentAt",id',[id]);
  const jobs=await db.query('SELECT id,"messageId",status,attempts,"errorCode","createdAt" FROM "AgentJob" WHERE "conversationId"=$1 ORDER BY "createdAt"',[id]);
  const tools=await db.query('SELECT "jobId",tool,outcome,"createdAt" FROM "AgentToolTrace" WHERE "conversationId"=$1 ORDER BY "createdAt"',[id]);
  const calls=await db.query('SELECT "jobId",provider,model,success,"errorCode","latencyMs","toolCallCount" FROM "AIInvocation" WHERE "conversationId"=$1 ORDER BY "createdAt"',[id]);
  const messageIndex=new Map(messages.rows.map((m,i)=>[m.id,i+1])),jobIndex=new Map(jobs.rows.map((j,i)=>[j.id,i+1]));
  const lead=c.leadId?(await db.query('SELECT l.area,l."estimatedPrice",l.status,s.code service FROM "Lead" l LEFT JOIN "Service" s ON s.id=l."serviceId" WHERE l.id=$1',[c.leadId])).rows[0]:null;
  const extras=c.leadId?(await db.query('SELECT e.code,x.quantity,x."unitPrice" FROM "LeadExtra" x JOIN "ServiceExtra" e ON e.id=x."extraId" WHERE x."leadId"=$1',[c.leadId])).rows:[];
  incidents.push({sample:index+1,control:c.control,stage:c.stage,revision:c.revision,state:{draftFacts:safeFacts(c.state?.draftFacts),nextInput:c.state?.nextInput,quoteInput:safeFacts(c.state?.quote?.input),quoteTotal:c.state?.quote?.total},messages:messages.rows.map((m,i)=>({turn:i+1,author:m.author,at:m.sentAt,suppliedGoldenMessage:supplied.indexOf(m.text)+1,applianceMention:{fridge:/холодиль|fridge|fri[zž]ider/iu.test(m.text),oven:/духов|oven|rern/iu.test(m.text)},asksExtras:/Нужны ли дополнительные услуги/iu.test(m.text),emptyContinuation:/Продолжим с предыдущего вопроса/iu.test(m.text),inputIntent:m.structured?.inputIntent,replyIntent:m.structured?.replySet?.intent,replyRevision:m.structured?.replySet?.revision,autonomy:m.structured?.autonomy})),jobs:jobs.rows.map((j,i)=>({job:i+1,messageTurn:messageIndex.get(j.messageId),status:j.status,attempts:j.attempts,errorCode:j.errorCode})),tools:tools.rows.map(t=>({job:jobIndex.get(t.jobId),tool:t.tool,outcome:t.outcome})),invocations:calls.rows.map(x=>({job:jobIndex.get(x.jobId),provider:x.provider,model:x.model,success:x.success,errorCode:x.errorCode,latencyMs:x.latencyMs,toolCallCount:x.toolCallCount})),lead:lead?{...lead,extras}:null});
 }
 const catalog=(await db.query('SELECT code,"unitPrice",active FROM "ServiceExtra" ORDER BY code')).rows;
 const settings=(await db.query('SELECT "aiAgentMode","aiChannelModes" FROM "BusinessSettings" WHERE id=$1',['default'])).rows;
 await db.query('ROLLBACK');
 const report={readOnly:true,checkedAt:new Date().toISOString(),matchedConversations:found.rowCount,traceLimitation:'Existing AgentToolTrace stores tool/outcome, not arguments, outputs or per-turn fact snapshots; current state is latest only.',catalog,settings,incidents};
 writeFileSync('qa-output/conversation-incident-audit.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
}
main().catch(e=>{console.error(e.code??'INCIDENT_AUDIT_FAILED');process.exitCode=1;}).finally(()=>db.end());
