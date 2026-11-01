// Owner-authorized deterministic fixture. Never production certification or native/live proof.
import assert from 'node:assert/strict';
import {createHmac,randomUUID} from 'node:crypto';
import type {PrismaClient} from '../../src/generated/prisma/client';
import {runDiagnostics,readiness} from '../../src/lib/agent/readiness';
import {liveConfigFingerprint} from '../../src/lib/agent/live-proof';
import {localClusterDirectory} from '../../scripts/release-readiness/environment.mjs';
import {sourceFingerprint} from '../../src/lib/agent/release-verification.mjs';

export async function syntheticReadiness(db:PrismaClient) {
  assert.equal(process.env.LUMACLEAN_SYNTHETIC_READINESS,'true','Explicit isolated fixture opt-in required');
  const target=new URL(process.env.AI_TEST_DATABASE_URL!);
  assert.equal(target.hostname,'127.0.0.1');assert.equal(target.port,'55449');assert.equal(target.pathname,'/lumaclean_ai_test');
  const [identity]=await db.$queryRaw<{database:string;directory:string;version:number}[]>`SELECT current_database() AS database,current_setting('data_directory') AS directory,current_setting('server_version_num')::int AS version`;
  assert.equal(identity.database,'lumaclean_ai_test');assert.equal(identity.directory.replaceAll('\\','/').toLowerCase(),localClusterDirectory().replaceAll('\\','/').toLowerCase());assert(identity.version>=180000);
  assert.equal(await db.client.count(),0,'Fresh synthetic database required');assert.equal(await db.order.count(),0);
  const before={...process.env},fetchBefore=globalThis.fetch;
  Object.assign(process.env,{
    AI_AGENT_ENABLED:'true',AI_VERIFIED_RELEASE:'true',AI_VERIFIED_SOURCE_FINGERPRINT:sourceFingerprint(),AI_VERIFIED_TEST_COUNT:'isolated-fixture-only',
    AI_LIVE_TEST_SECRET:'synthetic-loopback-proof-key-not-valid-for-any-deployment',
    GOOGLE_MAPS_SERVER_API_KEY:'synthetic-key',POYO_API_KEY:'synthetic-key',OPENROUTER_API_KEY:'synthetic-key',
    PRIMARY_AGENT_PROVIDER:'poyo',FALLBACK_AGENT_PROVIDER:'openrouter',PRIMARY_AGENT_MODEL:'test',FALLBACK_AGENT_MODEL:'backup',
    LUMACLEAN_ROUTING_PROVIDER:'GOOGLE',LUMACLEAN_GOOGLE_ROUTING_ENABLED:'true',
  });
  globalThis.fetch=async()=>{throw Error('External network forbidden in isolated AI suite');};
  const refresh=async()=>{
    const current=globalThis.fetch;
    globalThis.fetch=async input=>{
      const url=String(input);
      const data=url.includes('poyo')?{status:'completed',output:[{type:'function_call',call_id:'probe',name:'getBusinessInfo',arguments:'{}'}]}:
        url.includes('openrouter')?{choices:[{message:{tool_calls:[{id:'probe',function:{name:'getBusinessInfo',arguments:'{}'}}]}}]}:
        url.includes('places.googleapis.com')?{suggestions:[{placePrediction:{placeId:'synthetic',text:{text:'Synthetic'}}}]}:
        url.includes('routes.googleapis.com')?[{originIndex:0,destinationIndex:0,condition:'ROUTE_EXISTS',duration:'1200s',distanceMeters:1000}]:null;
      assert(data,`Unexpected synthetic diagnostic endpoint: ${new URL(url).hostname}`);
      return new Response(JSON.stringify(data),{status:200});
    };
    try{await runDiagnostics(db);}finally{globalThis.fetch=current;}
    const data={version:1,config:await liveConfigFingerprint(db),at:new Date().toISOString(),batch:randomUUID(),passed:true,cleaned:true};
    const signature=createHmac('sha256',process.env.AI_LIVE_TEST_SECRET!).update(JSON.stringify(data)).digest('hex');
    await db.businessSettings.update({where:{id:'default'},data:{aiLiveTestProof:{...data,signature}}});
    const report=await readiness(db);assert(report.canActivate,JSON.stringify(report.blockers));
  };
  return {refresh,restore(){globalThis.fetch=fetchBefore;for(const key of Object.keys(process.env))if(!(key in before))delete process.env[key];Object.assign(process.env,before);}};
}
