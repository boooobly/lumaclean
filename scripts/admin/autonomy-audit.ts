// Read-only production diagnosis. Never emit client messages, contacts, addresses or IDs.
import {Client} from 'pg';
import {pgConnectionString} from '../../src/lib/database/connection';
const url=process.env.DATABASE_URL;
if(!url||!new URL(url).hostname.startsWith('ep-bitter-mode-b8r8ruag'))throw Error('PRODUCTION_READ_ONLY_TARGET_REQUIRED');
const db=new Client({connectionString:pgConnectionString(url)});
async function main(){
 await db.connect();await db.query('BEGIN READ ONLY');await db.query("SET LOCAL statement_timeout='20s'");
 const modes=await db.query('SELECT "aiAgentMode", "aiChannelModes" FROM "BusinessSettings" WHERE id=$1',['default']);
 const counts=await db.query('SELECT count(*)::int conversations, count(*) FILTER (WHERE "orderId" IS NOT NULL)::int with_order FROM "Conversation"');
 const rows=await db.query(`SELECT h.reason,h."requestedAt",c."externalThreadId",c."anonymousHash",c.state,
 (SELECT json_agg(json_build_object('author',m.author,'text',m.text,'at',m."sentAt") ORDER BY m."sentAt") FROM "Message" m WHERE m."conversationId"=c.id) messages,
 (SELECT json_agg(json_build_object('tool',t.tool,'outcome',t.outcome) ORDER BY t."createdAt") FROM "AgentToolTrace" t WHERE t."conversationId"=c.id AND t."createdAt"<=h."requestedAt") tools,
 (SELECT json_agg(json_build_object('provider',i.provider,'success',i.success,'error',i."errorCode")) FROM "AIInvocation" i WHERE i."conversationId"=c.id AND i."createdAt"<=h."requestedAt") invocations,
 (SELECT count(*)::int FROM "ShadowSuggestion" s WHERE s."conversationId"=c.id) shadows
 FROM "HumanHandoff" h JOIN "Conversation" c ON c.id=h."conversationId" ORDER BY h."requestedAt" DESC LIMIT 200`);
 const aggregate:Record<string,number>={};let synthetic=0,real=0;const sample=[];
 for(const r of rows.rows){
  aggregate[r.reason]=(aggregate[r.reason]??0)+1;
  // Known internal namespaces only; an anonymous web session alone is not proof of a real client.
  const test=/(?:test|proof|preview|benchmark|qa|fixture|live-booking|readiness)/i.test(r.externalThreadId??'');
  if(test){synthetic++;continue;}real++;
  const client=(r.messages??[]).filter((m:{author:string;at:string})=>m.author==='CLIENT'&&new Date(m.at)<=r.requestedAt).at(-1);
  const text=client?.text??'';
  sample.push({sample:real,reason:r.reason,clientTurn:(r.messages??[]).filter((m:{author:string;at:string})=>m.author==='CLIENT'&&new Date(m.at)<=r.requestedAt).length,
   categories:{payment:/карт|card|kartic|картиц/i.test(text),discount:/скид|discount|popust|попуст/i.test(text),upholstery:/диван|sofa|химчист|namešt|намешт/i.test(text),hazard:/плес|mold|needle|игл|канал|blood/i.test(text),complaint:/разбил|компенсац|broke|complaint|жалоб/i.test(text),question:/\?/.test(text)},
   tools:(r.tools??[]).slice(-8),invocations:(r.invocations??[]).reduce((a:Record<string,number>,i:{provider:string;error:string|null})=>{const k=i.provider+':'+(i.error??'OK');a[k]=(a[k]??0)+1;return a;},{}),shadows:r.shadows,hasQuote:!!r.state?.quote,hasDraft:!!r.state?.draftFacts,hasUpholstery:!!r.state?.upholsteryInquiry,
   ...(process.argv.includes('--inspect')?{privateContext:(r.messages??[]).filter((m:{author:string;at:string})=>m.author==='CLIENT'&&new Date(m.at)<=r.requestedAt).slice(-3).map((m:{text:string})=>m.text.replace(/\+?\d[\d\s()-]{5,}/g,'[redacted]').replace(/\S+@\S+/g,'[redacted]').slice(0,250))}:{})});
 }
 await db.query('ROLLBACK');console.log(JSON.stringify({readOnly:true,modes:modes.rows,counts:counts.rows,handoffsSampled:rows.rowCount,knownSynthetic:synthetic,unverifiedCustomerSample:real,reasons:aggregate,sample},null,2));
}
main().catch(e=>{console.error(e.code??e.message);process.exitCode=1;}).finally(()=>db.end());
