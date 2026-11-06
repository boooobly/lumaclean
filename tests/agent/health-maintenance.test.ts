import assert from 'node:assert/strict';import test from 'node:test';
import type {PrismaClient} from '../../src/generated/prisma/client';
import {maintainAiHealth} from '../../src/lib/agent/health-maintenance';
import {GET} from '../../src/app/api/agent/health/route';

test('health maintenance is disabled by default, mode-bound and concurrency-limited (isolated fixtures)',async()=>{
 const env={...process.env};let calls=0,claims=0,reads=0;
 const settings={aiAgentMode:'AUTO',aiChannelModes:{WEBSITE:'AUTO'},aiDiagnostics:null,aiDiagnosticsAt:null};
 const db={businessSettings:{findUniqueOrThrow:async()=>{reads++;return settings;}},$queryRaw:async()=>++claims===1?[{count:1}]:[]} as unknown as PrismaClient;
 const good={ok:true,code:'synthetic'},report={primary:good,fallback:good,places:good,transit:good};
 const dependencies={bounded:async<T>(fn:()=>Promise<T>)=>fn(),diagnose:async()=>{calls++;return report;}};
 try{
  Object.assign(process.env,{VERCEL:'1',VERCEL_ENV:'production',AI_AGENT_ENABLED:'true',AI_VERIFIED_RELEASE:'true'});delete process.env.AI_READINESS_CRON_ENABLED;
  assert.equal((await maintainAiHealth(db,dependencies)).reason,'DISABLED');assert.equal(reads,0);
  process.env.AI_READINESS_CRON_ENABLED='true';
  settings.aiAgentMode='OFF';assert.equal((await maintainAiHealth(db,dependencies)).reason,'MODE_OFF');assert.equal(calls,0);
  settings.aiAgentMode='AUTO';
  const results=await Promise.all(Array.from({length:8},()=>maintainAiHealth(db,dependencies)));
  assert.equal(results.filter(r=>r.status==='PASS').length,1);assert.equal(results.filter(r=>r.reason==='ALREADY_ATTEMPTED').length,7);assert.equal(calls,1);
  claims=0;assert.equal((await maintainAiHealth(db,{...dependencies,diagnose:async()=>({...report,primary:{ok:false,code:'PROVIDER_UNAVAILABLE'}})})).status,'FAIL');
  await assert.rejects(maintainAiHealth({businessSettings:{findUniqueOrThrow:async()=>{throw new Error('private database information');}}} as unknown as PrismaClient,dependencies));
 }finally{for(const key of Object.keys(process.env))if(!(key in env))delete process.env[key];Object.assign(process.env,env);}
});

test('health HTTP rejects unauthenticated calls before database access and never caches',async()=>{
 const before=process.env.CRON_SECRET;process.env.CRON_SECRET='isolated-cron-secret';
 try{for(const authorization of ['', 'Bearer wrong','Bearer é']){const response=await GET(new Request('http://localhost/api/agent/health',{headers:{authorization}}));assert.equal(response.status,401);assert.match(response.headers.get('cache-control')??'',/no-store/);}}
 finally{if(before===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=before;}
});
