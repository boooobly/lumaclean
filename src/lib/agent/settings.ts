import {z} from 'zod';
import type {PrismaClient} from '@/generated/prisma/client';
import {schedulingLock} from '@/lib/services/scheduling-commands';
import {writeAudit} from '@/lib/services/audit';
import {AgentError} from './contracts';
import {assertAutoReady,runDiagnostics} from './readiness';
import {runFinanceCommand} from '@/lib/services/finance-commands';
import {extrasPrices} from '@/lib/pricing';
import {liveConfigFingerprint,validLiveProof} from './live-proof';
const mode=z.enum(['OFF','SHADOW','AUTO']);
export const aiSettingsSchema=z.discriminatedUnion('action',[
  z.object({action:z.literal('diagnostics')}).strict(),
  z.object({action:z.literal('starter-duration'),service:z.enum(['regular','deep']),reserveMinutes:z.number().int().min(0).max(60),confirm:z.literal(true)}).strict(),
  z.object({action:z.literal('live-test'),date:z.iso.date(),service:z.enum(['regular','deep']).optional()}).strict(),
  z.object({action:z.literal('import-live-proof'),proof:z.string().min(1).max(2000)}).strict(),
  z.object({action:z.literal('settings'),channels:z.object({WEBSITE:mode,TELEGRAM:z.literal('OFF'),WHATSAPP:z.literal('OFF'),VIBER:z.literal('OFF')}).strict(),allowedServices:z.array(z.enum(['regular','deep','move','airbnb','office'])).min(1).max(5),canary:z.literal(true),maxMessages:z.number().int().min(10).max(1000),maxModelCalls:z.number().int().min(1).max(16),maxToolSteps:z.number().int().min(1).max(8),maxConversationCost:z.number().finite().min(0.01).max(10),dailyWarning:z.number().finite().min(0.1).max(100),confirmAuto:z.literal(true).optional()}).strict(),
]);
export async function runAiSettings(db:PrismaClient,userId:string,payload:unknown){
  const input=aiSettingsSchema.parse(payload);
  if(!await db.user.count({where:{id:userId,active:true,role:'ADMIN'}}))throw new AgentError('FORBIDDEN');
  if(input.action==='diagnostics')return runDiagnostics(db);
  if(input.action==='live-test'){const {runLiveBookingTest}=await import('./live-test');return runLiveBookingTest(db,userId,input.date,input.service);}
  if(input.action==='starter-duration'){
    const regular=input.service==='regular';
    return runFinanceCommand(db,userId,'duration-rule',{service:input.service,previousId:null,active:true,minArea:regular?1:40,maxArea:regular?100:60,referenceArea:regular?100:50,cleanerCount:2,baseMinutes:regular?150:480,minutesPerSquare:0,reserveMinutes:input.reserveMinutes,unknownExtraReserveMinutes:0,soilMultipliers:{LIGHT:1,NORMAL:1,HEAVY:1,EXTREME:1},extraMinutes:Object.fromEntries(Object.keys(extrasPrices).map(code=>[code,null])),notes:'Стартовый ориентир, явно подтверждён владельцем. Без экстраполяции. Сложное загрязнение — handoff.'});
  }
  if(input.action==='import-live-proof'){
    let proof:unknown;try{proof=JSON.parse(input.proof);}catch{throw new AgentError('LIVE_PROOF_INVALID');}
    return db.$transaction(async tx=>{await schedulingLock(tx,'settings','ai');if(!await tx.user.count({where:{id:userId,active:true,role:'ADMIN'}}))throw new AgentError('FORBIDDEN');if(!validLiveProof(proof,await liveConfigFingerprint(tx)))throw new AgentError('LIVE_PROOF_EXPIRED_OR_CONFIG_CHANGED');await tx.businessSettings.update({where:{id:'default'},data:{aiLiveTestProof:proof as import('@/generated/prisma/client').Prisma.InputJsonValue}});await writeAudit(tx,{type:'USER',userId},{action:'AI_LIVE_PROOF_IMPORTED',entityType:'BusinessSettings',entityId:'default'});return{ok:true};});
  }
  return db.$transaction(async tx=>{
    await schedulingLock(tx,'settings','ai');
    if(!await tx.user.count({where:{id:userId,active:true,role:'ADMIN'}}))throw new AgentError('FORBIDDEN');
    const old=await tx.businessSettings.findUniqueOrThrow({where:{id:'default'}});
    const data={aiChannelModes:input.channels,aiAllowedServices:[...new Set(input.allowedServices)],aiCanary:true,aiMaxAnonymousMessages:input.maxMessages,aiMaxModelCalls:input.maxModelCalls,aiMaxToolSteps:input.maxToolSteps,aiMaxConversationCostUsd:input.maxConversationCost,aiDailyCostWarningUsd:input.dailyWarning};
    const next={...old,...data,aiMaxConversationCostUsd:old.aiMaxConversationCostUsd,aiDailyCostWarningUsd:old.aiDailyCostWarningUsd};
    const previousChannels=old.aiChannelModes as Record<string,string>;
    const expandsAuto=Object.entries(input.channels).some(([channel,value])=>value==='AUTO'&&previousChannels[channel]!=='AUTO')||input.allowedServices.some(service=>!old.aiAllowedServices.includes(service));
    if(old.aiAgentMode==='AUTO'&&expandsAuto&&Object.values(input.channels).includes('AUTO')){
      if(!input.confirmAuto)throw new AgentError('AUTO_CONFIRMATION_REQUIRED');
      await assertAutoReady(tx,next);
    }
    await tx.businessSettings.update({where:{id:'default'},data});
    await tx.conversation.updateMany({where:{control:'AI_CONTROL'},data:{revision:{increment:1}}});
    await tx.message.updateMany({where:{author:'AI',deliveryStatus:'PENDING'},data:{deliveryStatus:'CANCELLED'}});
    await writeAudit(tx,{type:'USER',userId},{action:'AI_CHANNEL_SCOPE_CHANGED',entityType:'BusinessSettings',entityId:'default',changes:{status:{before:JSON.stringify(old.aiChannelModes),after:JSON.stringify(input.channels)},changedFields:{before:old.aiAllowedServices,after:data.aiAllowedServices}}});
    await writeAudit(tx,{type:'USER',userId},{action:'AI_COST_LIMITS_CHANGED',entityType:'BusinessSettings',entityId:'default',changes:{changedFields:{before:null,after:['maxMessages','maxModelCalls','maxToolSteps','maxConversationCost','dailyWarning']}}});
    return{ok:true};
  },{timeout:20000});
}
