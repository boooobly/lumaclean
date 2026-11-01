import assert from 'node:assert/strict';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {hashPassword} from 'better-auth/crypto';
import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from '../../src/generated/prisma/client';
import {acceptMessage,publicConversation} from '../../src/lib/agent/inbox';
import {claimJob} from '../../src/lib/agent/runner';
import {saveWebsiteLead} from '../../src/lib/services/website-leads';
async function main(){
const u=new URL(process.env.DATABASE_URL!);
assert.equal(u.hostname,'127.0.0.1');assert.equal(u.port,'55449');assert.equal(u.pathname,'/lumaclean_ai_test');
assert.equal(process.env.AI_AGENT_ENABLED,'false');
let queries=0;
const db=new PrismaClient({adapter:new PrismaPg({connectionString:u.toString(),max:2}),log:[{emit:'event',level:'query'}]});
db.$on('query',()=>queries++);
try {
 const dir=await db.$queryRawUnsafe<{data_directory:string}[]>('SHOW data_directory');
 assert.equal(dir[0].data_directory.replaceAll('\\','/').toLowerCase(),path.resolve('artifacts/release-readiness/pgdata').replaceAll('\\','/').toLowerCase());
 const id=randomUUID(),email=`audit-${id}@example.test`,password=randomUUID()+'Aa!7';
 await db.user.create({data:{id,name:'Synthetic audit owner',email,emailVerified:true,role:'ADMIN',accounts:{create:{accountId:id,providerId:'credential',password:await hashPassword(password)}}}});
 writeFileSync('artifacts/admin/ai-local-owner.json',JSON.stringify({email,password}));
 // Persisted AUTO plus disabled runtime must drain with no model invocation or CRM mutation.
 await db.businessSettings.update({where:{id:'default'},data:{aiAgentMode:'AUTO',aiChannelModes:{WEBSITE:'AUTO'}}});
 const c=await db.conversation.create({data:{channel:'WEBSITE'}});
 await acceptMessage(db,c,{id:randomUUID(),text:'Synthetic audit enquiry'});
 assert.equal(await claimJob(db,c.id),null);
 assert.equal(await db.aIInvocation.count(),0);assert.equal(await db.order.count(),0);assert.equal(await db.lead.count(),0);
 const start=queries;
 for(let i=0;i<40;i++)await publicConversation(db,c);
 const snapshotQueries=queries-start;
 const lead=await saveWebsiteLead(db,{submissionId:randomUUID(),phone:'0641234567',locale:'ru',consent:true,service:'regular',area:50,extras:[{code:'steam',quantity:1}]});
 assert.equal((await db.lead.findUniqueOrThrow({where:{id:lead.id}})).humanReviewRequired,true);
 assert.equal(await db.notification.count({where:{eventKey:`website-lead:${lead.id}:telegram`}}),1);
 const report={host:u.hostname,port:u.port,database:u.pathname,clusterVerified:true,aiOffNoCallsOrOrders:true,steamManualReview:true,snapshots:40,queries:snapshotQueries,queriesPerSnapshot:snapshotQueries/40,projectedQueriesPerMinuteAt1500ms:snapshotQueries};
 writeFileSync('artifacts/audit-20261101/database-chat-measurement.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
} finally {await db.$disconnect();}
}
void main();
