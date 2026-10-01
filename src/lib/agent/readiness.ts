import { createHash } from 'node:crypto';
import type { Prisma, BusinessSettings, Channel, AgentMode } from '@/generated/prisma/client';
import { durationConfig } from '@/lib/services/duration-engine';
import { estimateDuration } from '@/lib/domain/duration';
import { quote } from '@/lib/domain/crm-pricing';
import { placesRequest } from '@/lib/services/google-places';
import { GoogleRoutesProvider } from '@/lib/infrastructure/google-routing';
import { configuredProviders } from './providers';
import { customerTelegramConfigured } from './channels';
import { AgentError } from './contracts';

export type Check = { id:string; label:string; status:'READY'|'WARNING'|'BLOCKS_AUTO'; detail:string };
type DB=Prisma.TransactionClient;
type Probe={ok:boolean;code:string};
type Diagnostics={fingerprint:string;primary:Probe;fallback:Probe;places:Probe;transit:Probe};
export const channelNames=['WEBSITE','TELEGRAM','WHATSAPP','VIBER'] as const;
export function effectiveMode(s:Pick<BusinessSettings,'aiAgentMode'|'aiChannelModes'>,channel:Channel):AgentMode {
  const scope=(s.aiChannelModes as Record<string,string>)[channel]??'OFF';
  if(process.env.AI_AGENT_ENABLED!=='true'||s.aiAgentMode==='OFF'||scope==='OFF')return 'OFF';
  return s.aiAgentMode==='AUTO'&&scope==='AUTO'?'AUTO':'SHADOW';
}
function fingerprint(){
  return createHash('sha256').update(JSON.stringify(['POYO_API_KEY','OPENROUTER_API_KEY','PRIMARY_AGENT_MODEL','FALLBACK_AGENT_MODEL','PRIMARY_AGENT_PROVIDER','FALLBACK_AGENT_PROVIDER','GOOGLE_MAPS_SERVER_API_KEY','TELEGRAM_CUSTOMER_BOT_TOKEN'].map(k=>process.env[k]??''))).digest('hex');
}
export function cleanerReadiness(c:{active:boolean;homeAddress:string|null;homeLatitude:unknown;homeLongitude:unknown;languages:string[];payoutPercent:unknown;availability:{startMinute:number|null;endMinute:number|null;kind:string}[]}){
  const hours=c.availability.some(a=>['WEEKLY','AVAILABLE'].includes(a.kind)&&a.startMinute!==null&&a.endMinute!==null&&a.endMinute>a.startMinute);
  const address=!!c.homeAddress,coordinates=c.homeLatitude!==null&&c.homeLongitude!==null;
  return {ready:c.active&&hours&&address&&coordinates,active:c.active,hours,address,coordinates,languages:!!c.languages.length,payout:c.payoutPercent!==null};
}
export async function readiness(db:DB,provided?:BusinessSettings){
  const settings=provided??await db.businessSettings.findUnique({where:{id:'default'}});
  const checks:Check[]=[];
  const add=(id:string,label:string,ready:boolean,detail:string,warning=false)=>checks.push({id,label,status:ready?'READY':warning?'WARNING':'BLOCKS_AUTO',detail});
  add('settings','Scheduling',!!settings&&settings.timezone==='Europe/Belgrade'&&Number.isInteger(settings.defaultTravelBufferMinutes)&&settings.defaultTravelBufferMinutes>=0,settings?`${settings.timezone} · транспортный буфер ${settings.defaultTravelBufferMinutes} мин`:'BusinessSettings отсутствуют');
  add('master','AI server',process.env.AI_AGENT_ENABLED==='true','AI_AGENT_ENABLED должен быть true');
  add('credentials','AI credentials',!!process.env.POYO_API_KEY&&!!process.env.OPENROUTER_API_KEY&&!!process.env.PRIMARY_AGENT_MODEL&&!!process.env.FALLBACK_AGENT_MODEL,'Ключи остаются только на сервере. Модели задаются через env.');
  const diag=settings?.aiDiagnostics as Diagnostics|null;
  const fresh=!!diag&&diag.fingerprint===fingerprint()&&!!settings?.aiDiagnosticsAt&&Date.now()-settings.aiDiagnosticsAt.getTime()<3600000;
  for(const [id,label] of [['primary','Primary model'],['fallback','Fallback model'],['places','Google Places'],['transit','Google Routes Transit']] as const){
    const probe=fresh?diag?.[id]:null;
    add(id,label,!!probe?.ok,probe?.code??(((id==='places'||id==='transit')&&!process.env.GOOGLE_MAPS_SERVER_API_KEY)?'Нужен GOOGLE_MAPS_SERVER_API_KEY (Places API New + Routes API, billing)':'Запустите диагностику: проверка отсутствует или старше 1 часа'));
  }
  add('browserMap','Google Map JS',!!process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_API_KEY,'NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_API_KEY: Maps JavaScript API и ограничения по доменам. Наличие ключа; загрузку карты проверяйте в Routing.',true);
  const cleaners=await db.cleaner.findMany({where:{active:true},include:{availability:true}});
  const readyCleaners=cleaners.filter(c=>cleanerReadiness(c).ready).length;
  add('cleaners','Клинеры',readyCleaners>=1&&readyCleaners===cleaners.length,`Активных: ${cleaners.length}; готовы (часы + старт + координаты): ${readyCleaners}`);
  const services=await db.service.findMany({where:{code:{in:settings?.aiAllowedServices??[]}},include:{durationRules:{where:{active:true}},priceBands:true}});
  const supported=settings?.aiAllowedServices??[];
  let configured=!!supported.length&&services.length===supported.length,pricing=configured;
  const bands:string[]=[];
  for(const service of services){
    let good=false;
    for(const rule of service.durationRules){
      try{const cfg=durationConfig(rule);const result=estimateDuration({serviceId:service.id,area:Math.max(1,cfg.minArea),soilLevel:'NORMAL',requiredCleaners:cfg.cleanerCount,extras:[]},service.durationRules.map(durationConfig));
        if(result&&rule.cleanerCount<=readyCleaners){good=true;bands.push(`${service.code}: ${cfg.minArea}–${cfg.maxArea} м², ${cfg.cleanerCount} клинера`);}
      }catch{/* Invalid or overlapping rules block this service. */}
    }
    configured&&=service.active&&good;
    try{pricing&&=service.active&&service.priceBands.length>0&&quote(service.code as Parameters<typeof quote>[0],50,[],false).total>0;}catch{pricing=false;}
  }
  add('duration','Duration Rules',configured,bands.length?bands.join('; '):'Нет активных подтверждённых правил для услуг AUTO. За пределами диапазонов запись передаётся человеку.');
  add('pricing','Pricing engine',pricing,'Все услуги AUTO должны иметь активный каталог и цены; нестандартная цена передаётся человеку.');
  const release=process.env.AI_VERIFIED_RELEASE==='true';
  add('tests','Website Chat / targeted tests',release,release?`Проверена текущая сборка: ${process.env.AI_VERIFIED_TEST_COUNT??'?'} targeted tests (session, limits, persistence, confirmation, fallback, outbox).`:'Нет подтверждения targeted tests для текущего кода сборки.');
  const suggestions=await db.shadowSuggestion.count({where:{createdAt:{gte:new Date(Date.now()-30*86400000)}}});
  const verdicts=await db.shadowSuggestion.groupBy({by:['verdict'],where:{reviewedAt:{gte:new Date(Date.now()-30*86400000)}},_count:true});
  const accepted=verdicts.find(v=>v.verdict==='ACCEPTED')?._count??0,rejected=verdicts.find(v=>v.verdict==='REJECTED')?._count??0,n=accepted+rejected;
  add('shadow','Оценка SHADOW',n>0&&rejected===0,`Suggestions ${suggestions}; проверено n=${n}; принято ${accepted}; исправлено ${rejected}. ${n?'Оцените причины исправлений; малая выборка не доказывает качество.':'Оцените реальные предложения в Inbox перед AUTO.'}`,true);
  add('scope','AUTO — ограниченный запуск',!!settings?.aiCanary,'Стандартные сценарии; исключения всегда передаются человеку.');
  const modes=settings?.aiChannelModes as Record<string,string>|undefined;
  add('channels','Каналы',modes?.WHATSAPP==='OFF'&&modes?.VIBER==='OFF'&&(modes?.TELEGRAM==='OFF'||customerTelegramConfigured()),'WhatsApp/Viber должны быть OFF. Telegram требует отдельный customer bot и webhook secret.');
  const spent=await db.aIInvocation.aggregate({where:{createdAt:{gte:new Date(new Date().toISOString().slice(0,10))}},_sum:{estimatedCostUsd:true}});
  add('cost','Расход за сутки',Number(spent._sum.estimatedCostUsd??0)<=Number(settings?.aiDailyCostWarningUsd??5),`≈ $${Number(spent._sum.estimatedCostUsd??0).toFixed(4)}; warning $${settings?.aiDailyCostWarningUsd??5}. Это предупреждение, лимиты каждого диалога обязательны.`,true);
  return {checks,blockers:checks.filter(c=>c.status==='BLOCKS_AUTO'),shadow:{suggestions,accepted,rejected,n},canActivate:checks.every(c=>c.status!=='BLOCKS_AUTO'),checkedAt:settings?.aiDiagnosticsAt?.toISOString()??null};
}
export async function assertAutoReady(db:DB,settings?:BusinessSettings){
  const report=await readiness(db,settings);
  if(!report.canActivate)throw new AgentError('AUTO_BLOCKED: '+report.blockers.map(c=>c.label).join(', '));
}
export async function runDiagnostics(db:DB){
  const probe=async(fn:()=>Promise<boolean>):Promise<Probe>=>{try{return await fn()?{ok:true,code:'Работает'}:{ok:false,code:'Нет подтверждённого ответа'};}catch(e){return {ok:false,code:e instanceof AgentError?e.code:'PROVIDER_UNAVAILABLE'};}};
  let primary:Probe={ok:false,code:'PROVIDER_UNCONFIGURED'},fallback={...primary};
  try{const providers=configuredProviders();[primary,fallback]=await Promise.all(providers.map(p=>probe(async()=>{const r=await p.complete([{role:'system',content:'Synthetic connectivity check. No customer data or CRM actions. Call getBusinessInfo with {} using native tool calling.'},{role:'user',content:'Call getBusinessInfo now.'}]);return r.toolCalls.some(t=>t.name==='getBusinessInfo'&&t.arguments.trim()==='{}');})));}catch{/* Configuration failure. */}
  const places=process.env.GOOGLE_MAPS_SERVER_API_KEY?await probe(async()=>{const r=await placesRequest('autocomplete',{query:'Terazije 1, Beograd',sessionToken:crypto.randomUUID()});return r.available&&'suggestions' in r&&r.suggestions.length>0;}):{ok:false,code:'Нужен GOOGLE_MAPS_SERVER_API_KEY'};
  const transit=process.env.GOOGLE_MAPS_SERVER_API_KEY?await probe(async()=>{const r=await new GoogleRoutesProvider().getRouteMatrix([{latitude:44.8125,longitude:20.4612}],[{latitude:44.8168,longitude:20.4156}],'TRANSIT',new Date(Date.now()+86400000).toISOString());return r[0]?.[0]?.status==='VERIFIED';}):{ok:false,code:'Нужен GOOGLE_MAPS_SERVER_API_KEY'};
  const diagnostics:Diagnostics={fingerprint:fingerprint(),primary,fallback,places,transit};
  await db.businessSettings.update({where:{id:'default'},data:{aiDiagnostics:diagnostics,aiDiagnosticsAt:new Date()}});
  return {primary,fallback,places,transit};
}
