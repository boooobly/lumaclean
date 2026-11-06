import {randomUUID} from 'node:crypto';
import type {PrismaClient} from '@/generated/prisma/client';
import {callBudget} from './runner';
import {diagnosticsAreFresh,runDiagnostics,type DiagnosticsOptions} from './readiness';
import {withNativeTestBudget} from '@/lib/services/native-test-budget';

type ProbeReport=Awaited<ReturnType<typeof runDiagnostics>>;
type Dependencies={diagnose?:(db:PrismaClient,options:DiagnosticsOptions)=>Promise<ProbeReport>;bounded?:<T>(fn:()=>Promise<T>)=>Promise<T>};
/** OFF by default. No conversations, notifications or jobs are processed here. */
export async function maintainAiHealth(db:PrismaClient,dependencies:Dependencies={}){
  if(process.env.VERCEL!=='1'||process.env.VERCEL_ENV!=='production'||process.env.AI_READINESS_CRON_ENABLED!=='true'||process.env.AI_AGENT_ENABLED!=='true'||process.env.AI_VERIFIED_RELEASE!=='true')return{status:'SKIP' as const,reason:'DISABLED'};
  const settings=await db.businessSettings.findUniqueOrThrow({where:{id:'default'}});
  if(settings.aiAgentMode!=='AUTO'||(settings.aiChannelModes as Record<string,string>).WEBSITE!=='AUTO')return{status:'SKIP' as const,reason:'MODE_OFF'};
  if(diagnosticsAreFresh(settings,20*60000))return{status:'SKIP' as const,reason:'FRESH'};
  const now=Date.now(),bucket=Math.floor(now/1800000),key='agent:diagnostics:cron';
  // One fixed row, at most one attempt per UTC half-hour even after a crash.
  const claimed=await db.$queryRaw<{count:number}[]>`INSERT INTO "RateLimit" (id,key,count,"lastRequest") VALUES (${randomUUID()},${key},${bucket},${BigInt(now)}) ON CONFLICT (key) DO UPDATE SET count=EXCLUDED.count,"lastRequest"=EXCLUDED."lastRequest" WHERE "RateLimit".count<EXCLUDED.count RETURNING count`;
  if(!claimed.length)return{status:'SKIP' as const,reason:'ALREADY_ATTEMPTED'};
  const diagnose=dependencies.diagnose??runDiagnostics;
  const bounded=dependencies.bounded??(<T>(fn:()=>Promise<T>)=>withNativeTestBudget('diagnostics',fn));
  const report=await bounded(()=>diagnose(db,{beforeModelCall:(messages,provider)=>callBudget(db,messages,provider)}));
  return{status:Object.values(report).every(probe=>probe.ok)?'PASS' as const:'FAIL' as const};
}
