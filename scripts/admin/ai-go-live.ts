// Explicit Preview-only synthetic fallback; diagnostics never create production business records.
import {readFileSync,writeFileSync} from 'node:fs';
import {randomUUID,randomBytes} from 'node:crypto';
import {loadEnvConfig} from '@next/env';
import {hashPassword} from 'better-auth/crypto';
import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from '../../src/generated/prisma/client';
import {pgConnectionString} from '../../src/lib/database/connection';
import {runDiagnostics} from '../../src/lib/agent/readiness';
import {configuredProviders} from '../../src/lib/agent/providers';
import {AgentError} from '../../src/lib/agent/contracts';
import {startWebsiteConversation,acceptMessage} from '../../src/lib/agent/inbox';
import {claimJob,runClaimedJob} from '../../src/lib/agent/runner';
loadEnvConfig(process.cwd());
const [stage,action]=process.argv.slice(2);
if(!['preview','production'].includes(stage)||!['diagnostics','fallback','preview-admin','revoke','inspect'].includes(action))throw Error('Explicit stage/action required');
if(['fallback','preview-admin','revoke'].includes(action)&&stage!=='preview')throw Error('Synthetic verification is Preview only');
let url='';for(const line of readFileSync(`C:/Users/vleko/.codex/private/lumaclean-neon-${stage}.env`,'utf8').split(/\r?\n/)){const m=line.match(/^DATABASE_URL=(.*)$/);if(m)url=m[1].trim().replace(/^"|"$/g,'');}
const expected=stage==='production'?'ep-bitter-mode-b8r8ruag':'ep-patient-field-b8mccfvd';
if(!new URL(url).hostname.startsWith(expected))throw Error('Unexpected branch');
const db=new PrismaClient({adapter:new PrismaPg({connectionString:pgConnectionString(url),max:2})});
async function main(){
  const before={clients:await db.client.count(),leads:await db.lead.count(),orders:await db.order.count()};
  if(action==='preview-admin'){
    const id=randomUUID(),email=`crm-preview-${id}@example.invalid`,password=randomBytes(24).toString('base64url');
    await db.user.create({data:{id,name:'AI Go Live Preview',email,role:'ADMIN',emailVerified:true,accounts:{create:{providerId:'credential',accountId:id,password:await hashPassword(password)}}}});
    writeFileSync('artifacts/admin/crm-preview-owner.json',JSON.stringify({email,password,id}));console.log('Temporary Preview verifier created');return;
  }
  if(action==='revoke'){
    const {email,id}=JSON.parse(readFileSync('artifacts/admin/crm-preview-owner.json','utf8'));if(!/^crm-preview-[a-f0-9-]+@example.invalid$/.test(email)||!id)throw Error('Unexpected verifier');
    await db.$transaction(async tx=>{await tx.session.deleteMany({where:{userId:id}});await tx.user.update({where:{id,email},data:{active:false}});});console.log('Temporary Preview verifier revoked; audit preserved');return;
  }
  if(action==='diagnostics')console.log(JSON.stringify({stage,diagnostics:await runDiagnostics(db)}));
  if(action==='fallback'){
    if((await db.businessSettings.findUniqueOrThrow({where:{id:'default'}})).aiAgentMode!=='SHADOW')throw Error('Preview must remain SHADOW');
    const c=await startWebsiteConversation(db,'ru',randomUUID());await acceptMessage(db,c.conversation,{id:randomUUID(),text:'Синтетическая проверка Preview. Нужна поддерживающая уборка квартиры 50 м², обычное загрязнение, без дополнений.',locale:'ru'});
    const claim=await claimJob(db,c.conversation.id);if(!claim||claim.mode!=='SHADOW')throw Error('SHADOW job required');
    const [primary,fallback]=configuredProviders();await runClaimedJob(db,claim,[{name:primary.name,model:primary.model,complete:async()=>{throw new AgentError('CONTROLLED_PRIMARY_UNAVAILABLE');}},fallback]);
    const done=await db.agentJob.findUniqueOrThrow({where:{id:claim.job.id}}),invocations=await db.aIInvocation.findMany({where:{jobId:claim.job.id}});
    if(done.status!=='DONE'||!invocations.some(i=>i.provider==='openrouter'&&i.success))throw Error('Live native fallback did not complete');
    console.log(JSON.stringify({stage,controlledFallback:true,conversationId:c.conversation.id,job:done.status,nativeFallbackCalls:invocations.filter(i=>i.success).length,aiSent:await db.message.count({where:{conversationId:c.conversation.id,author:'AI'}})}));
    writeFileSync('artifacts/admin/go-live-real-fallback.json',JSON.stringify({stage,conversationId:c.conversation.id,job:done.status,provider:fallback.name,model:fallback.model,invocations:invocations.length}));
  }
  const after={clients:await db.client.count(),leads:await db.lead.count(),orders:await db.order.count()};
  if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Business counts changed');
  console.log(JSON.stringify({stage,countsPreserved:after,mode:(await db.businessSettings.findUniqueOrThrow({where:{id:'default'}})).aiAgentMode}));
}
main().catch(()=>{console.error('Go-live verification failed safely; no credentials or personal data logged');process.exitCode=1;}).finally(()=>db.$disconnect());
