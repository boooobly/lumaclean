import { createHash } from 'node:crypto';
import type { Prisma, BusinessSettings, Channel, AgentMode } from '@/generated/prisma/client';
import { durationConfig } from '@/lib/services/duration-engine';
import { estimateDuration } from '@/lib/domain/duration';
import { quote } from '@/lib/domain/crm-pricing';
import { placesRequest } from '@/lib/services/google-places';
import { routingProvider,motisSelected } from '@/lib/infrastructure/routing-provider';
import {MotisRoutingProvider} from '@/lib/infrastructure/motis-routing';
import {busMapsAccess} from '@/lib/infrastructure/busmaps-status';
import { configuredProviders } from './providers';
import { AgentError } from './contracts';
import {liveConfigFingerprint,validLiveProof} from './live-proof';

export type Check = { id:string; label:string; status:'READY'|'WARNING'|'BLOCKS_AUTO'; detail:string;href?:string;action?:string };
type DB=Prisma.TransactionClient;
type Probe={ok:boolean;code:string;quality?:string};
type Diagnostics={fingerprint:string;primary:Probe;fallback:Probe;places:Probe;transit:Probe};
export const channelNames=['WEBSITE','TELEGRAM','WHATSAPP','VIBER'] as const;
export function effectiveMode(s:Pick<BusinessSettings,'aiAgentMode'|'aiChannelModes'>,channel:Channel):AgentMode {
  const scope=(s.aiChannelModes as Record<string,string>)[channel]??'OFF';
  if(process.env.AI_AGENT_ENABLED!=='true'||s.aiAgentMode==='OFF'||scope==='OFF')return 'OFF';
  return s.aiAgentMode==='AUTO'&&scope==='AUTO'?'AUTO':'SHADOW';
}
function fingerprint(){
  return createHash('sha256').update(JSON.stringify(['POYO_API_KEY','OPENROUTER_API_KEY','PRIMARY_AGENT_MODEL','FALLBACK_AGENT_MODEL','PRIMARY_AGENT_PROVIDER','FALLBACK_AGENT_PROVIDER','LUMACLEAN_ROUTING_PROVIDER','LUMACLEAN_ROUTING_URL','LUMACLEAN_ROUTING_TOKEN','BUSMAPS_STATUS','BUSMAPS_API_KEY','TELEGRAM_CUSTOMER_BOT_TOKEN'].map(k=>process.env[k]??''))).digest('hex');
}
export function cleanerReadiness(c:{active:boolean;name?:string;phone?:string;homeAddress:string|null;homeCoordinatesConfirmed?:boolean;homeLatitude:unknown;homeLongitude:unknown;languages:string[];payoutPercent:unknown;availability:{startMinute:number|null;endMinute:number|null;kind:string}[]}){
  const hours=c.availability.some(a=>a.kind==='WEEKLY'&&a.startMinute!==null&&a.endMinute!==null&&a.endMinute>a.startMinute);
  const address=!!c.homeAddress?.trim(),coordinates=c.homeCoordinatesConfirmed===true&&c.homeLatitude!=null&&c.homeLongitude!=null&&Number.isFinite(Number(c.homeLatitude))&&Number.isFinite(Number(c.homeLongitude))&&Math.abs(Number(c.homeLatitude))<=90&&Math.abs(Number(c.homeLongitude))<=180;
  const contact=!!c.name?.trim()&&!!c.phone?.trim();
  return {ready:c.active&&contact&&hours&&address&&coordinates,contact,active:c.active,hours,address,coordinates,languages:!!c.languages.length,payout:c.payoutPercent!==null};
}
export function websiteSummary(checks:Check[]){
  const groups=[['master','credentials','primary','fallback'],['places','transit'],['duration','pricing'],['cleaners','settings'],['tests','scope','channels','liveBooking']];
  return{ready:groups.filter(ids=>ids.every(id=>checks.some(c=>c.id===id&&c.status!=='BLOCKS_AUTO'))).length,total:groups.length};
}
export function previewBookingReady(checks:Check[],confirmedTestService:boolean){
  // Preview proves the actual failover path; AUTO admission still requires every check.
  const fallbackReady=checks.some(c=>c.id==='fallback'&&c.status==='READY');
  return confirmedTestService&&fallbackReady&&checks.every(c=>['liveBooking','duration','pricing'].includes(c.id)||(c.id==='primary'&&fallbackReady)||c.status!=='BLOCKS_AUTO');
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
  for(const [id,label] of [['primary','Primary model'],['fallback','Fallback model'],['places','Поиск адреса'],['transit','Дорога и транспорт']] as const){
    const probe=fresh?diag?.[id]:null;
    add(id,label,!!probe?.ok,probe?.code??'Запустите диагностику: проверка отсутствует или старше 1 часа');
  }
  add('browserMap','MapLibre / OpenFreeMap',true,'Карта необязательна. Проверьте отображение отдельно; отказ карты не блокирует запись.',true);
  const busmaps=busMapsAccess();
  add('busmaps','BusMaps',busmaps==='ACTIVE',busmaps==='PENDING_APPROVAL'?'PENDING_APPROVAL · запросы выключены; используется утверждённый резерв 80 минут. Одобрение не блокирует routing.':busmaps==='ACTIVE'?'ACTIVE · выбранные transit legs проверяются; ошибки и лимит возвращают резерв 80 минут.':'UNAVAILABLE · используется резерв 80 минут; provider необязателен.',true);
  const cleaners=await db.cleaner.findMany({where:{active:true},include:{availability:true}});
  const readyCleaners=cleaners.filter(c=>cleanerReadiness(c).ready).length;
  const services=await db.service.findMany({where:{code:{in:settings?.aiAllowedServices??[]}},include:{durationRules:{where:{active:true}},priceBands:true}});
  const supported=settings?.aiAllowedServices??[];
  let configured=!!supported.length&&services.length===supported.length,pricing=configured;
  const bands:string[]=[];
  for(const service of services){
    let good=false;
    for(const rule of service.durationRules){
      try{const cfg=durationConfig(rule);const result=estimateDuration({serviceId:service.id,area:Math.max(1,cfg.minArea),soilLevel:'NORMAL',requiredCleaners:cfg.cleanerCount,extras:[]},service.durationRules.map(durationConfig));
        if(result){good=true;bands.push(`${service.code}: ${cfg.minArea}–${cfg.maxArea} м², ${cfg.cleanerCount} клинера`);}
      }catch{/* Invalid or overlapping rules block this service. */}
    }
    configured&&=service.active&&good;
    try{pricing&&=service.active&&service.priceBands.length>0&&quote(service.code as Parameters<typeof quote>[0],50,[],false).total>0;}catch{pricing=false;}
  }
  add('duration','Duration Rules',configured,bands.length?bands.join('; '):'Нет активных подтверждённых правил для услуг AUTO. За пределами диапазонов запись передаётся человеку.');
  const requiredCrew=Math.max(1,...services.map(s=>Math.min(...s.durationRules.map(r=>r.cleanerCount))).filter(Number.isFinite));
  add('cleaners','Готовность клинеров',readyCleaners>=requiredCrew&&readyCleaners===cleaners.length,`Активных: ${cleaners.length}; готовы: ${readyCleaners}; нужно для утверждённых правил: ${requiredCrew}. Имя, телефон, недельный график, стартовый адрес и координаты обязательны. Процент выплаты не требуется.`);
  add('pricing','Pricing engine',pricing,'Все услуги AUTO должны иметь активный каталог и цены; нестандартная цена передаётся человеку.');
  const release=process.env.AI_VERIFIED_RELEASE==='true';
  add('tests','Website Chat / targeted tests',release,release?`Проверена текущая сборка: ${process.env.AI_VERIFIED_TEST_COUNT??'?'} targeted tests readiness/live-test. Базовая проверка предыдущего этапа сохранена.`:'Нет подтверждения targeted tests для текущего кода сборки.');
  const suggestions=await db.shadowSuggestion.count({where:{createdAt:{gte:new Date(Date.now()-30*86400000)}}});
  const verdicts=await db.shadowSuggestion.groupBy({by:['verdict'],where:{reviewedAt:{gte:new Date(Date.now()-30*86400000)}},_count:true});
  const accepted=verdicts.find(v=>v.verdict==='ACCEPTED')?._count??0,rejected=verdicts.find(v=>v.verdict==='REJECTED')?._count??0,n=accepted+rejected;
  add('shadow','Оценка SHADOW',n>=5&&rejected===0,`Проверено: ${n}; accepted: ${accepted}; rejected: ${rejected}. ${n<5?'Недостаточно данных для оценки качества.':'Оцените причины исправлений.'}`,true);
  add('scope','AUTO — ограниченный запуск',!!settings?.aiCanary,'Стандартные сценарии; исключения всегда передаются человеку.');
  const modes=settings?.aiChannelModes as Record<string,string>|undefined;
  add('channels','Каналы',modes?.WHATSAPP==='OFF'&&modes?.VIBER==='OFF'&&modes?.TELEGRAM==='OFF','Ограниченный AUTO работает только на Website. Telegram/WhatsApp/Viber остаются OFF.');
  const spent=await db.aIInvocation.aggregate({where:{createdAt:{gte:new Date(new Date().toISOString().slice(0,10))}},_sum:{estimatedCostUsd:true}});
  add('cost','Расход за сутки',Number(spent._sum.estimatedCostUsd??0)<=Number(settings?.aiDailyCostWarningUsd??5),`≈ $${Number(spent._sum.estimatedCostUsd??0).toFixed(4)}; warning $${settings?.aiDailyCostWarningUsd??5}. Это предупреждение, лимиты каждого диалога обязательны.`,true);
  const config=await liveConfigFingerprint(db);
  add('liveBooking','Live Preview booking',validLiveProof(settings?.aiLiveTestProof,config),'Нужен успешный тест записи в Preview с очисткой batch. Отчёт действует 7 дней и только для той же конфигурации.');
  const links:Record<string,[string,string]>={cleaners:['/admin/cleaners','Настроить'],duration:['#starter-duration','Подтвердить'],places:['#logistics','Инструкция'],transit:['#logistics','Инструкция'],browserMap:['#logistics','Проверить карту'],shadow:['/admin/messages?filter=UNREVIEWED','Оценить ответы'],liveBooking:['#live-booking','Тест записи'],pricing:['#duration-rules','Настроить'],primary:['#logistics','Диагностика'],fallback:['#logistics','Диагностика']};
  for(const check of checks){if(links[check.id])[check.href,check.action]=links[check.id];}
  const testService=services.find(s=>s.code==='regular')??services[0];
  let confirmedTestService=false;
  try {confirmedTestService=!!testService?.active&&!!estimateDuration({serviceId:testService.id,area:50,soilLevel:'NORMAL',requiredCleaners:Math.min(...testService.durationRules.map(r=>r.cleanerCount)),extras:[]},testService.durationRules.map(durationConfig))&&quote(testService.code as Parameters<typeof quote>[0],50,[],false).total>0;}catch{/* No owner-confirmed test rule. */}
  return {checks,summary:websiteSummary(checks),blockers:checks.filter(c=>c.status==='BLOCKS_AUTO'),canRunLiveTest:previewBookingReady(checks,confirmedTestService),routingStatus:fresh&&diag?.transit.ok?(diag.transit.quality==='LIVE_EXTERNAL'?'READY':'DEGRADED'):'BLOCKED',shadow:{suggestions,accepted,rejected,n},canActivate:checks.every(c=>c.status!=='BLOCKS_AUTO'),checkedAt:settings?.aiDiagnosticsAt?.toISOString()??null};
}
export async function assertAutoReady(db:DB,settings?:BusinessSettings){
  const report=await readiness(db,settings);
  if(!report.canActivate)throw new AgentError('AUTO_BLOCKED: '+report.blockers.map(c=>c.label).join(', '));
}
export async function runDiagnostics(db:DB){
  const probe=async(fn:()=>Promise<boolean>):Promise<Probe>=>{try{return await fn()?{ok:true,code:'Работает'}:{ok:false,code:'Нет подтверждённого ответа'};}catch(e){return {ok:false,code:e instanceof AgentError?e.code:'PROVIDER_UNAVAILABLE'};}};
  let primary:Probe={ok:false,code:'PROVIDER_UNCONFIGURED'},fallback={...primary};
  try{const providers=configuredProviders();[primary,fallback]=await Promise.all(providers.map(p=>probe(async()=>{const r=await p.complete([{role:'system',content:'Synthetic connectivity check. No customer data or CRM actions. Call getBusinessInfo with {} using native tool calling.'},{role:'user',content:'Call getBusinessInfo now.'}]);return r.toolCalls.some(t=>t.name==='getBusinessInfo'&&t.arguments.trim()==='{}');})));}catch{/* Configuration failure. */}
  const places=await probe(async()=>{const r=await placesRequest('autocomplete',{query:'Terazije 1, Beograd',sessionToken:crypto.randomUUID()});return r.available&&'suggestions' in r&&r.suggestions.length>0;});
  let routeQuality:string|undefined;
  const transit=await probe(async()=>{const provider=routingProvider();if(motisSelected()){const h=await new MotisRoutingProvider().datasetsStatus();if(!h.engine.healthy)return false;}const r=await provider.getTravelTime({origin:{latitude:44.8125,longitude:20.4612},destination:{latitude:44.8168,longitude:20.4156},mode:'TRANSIT',at:new Date(Date.now()+86400000).toISOString()});routeQuality=r.quality;return r.status==='VERIFIED'&&r.durationSeconds!==null;});
  if(routeQuality)transit.quality=routeQuality;
  if(transit.ok&&motisSelected())transit.code=routeQuality==='LIVE_EXTERNAL'?'Работает: BusMaps verified':'DEGRADED · MOTIS healthy, walking / резерв 80 мин; BusMaps необязателен';
  const diagnostics:Diagnostics={fingerprint:fingerprint(),primary,fallback,places,transit};
  await db.businessSettings.update({where:{id:'default'},data:{aiDiagnostics:diagnostics,aiDiagnosticsAt:new Date()}});
  return {primary,fallback,places,transit};
}
