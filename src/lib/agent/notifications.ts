import { randomUUID } from 'node:crypto';
import { send } from '@vercel/queue';
import { z } from 'zod';
import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import { localInput } from '@/lib/domain/crm';
import { channelConfiguration, type CustomerChannel, type DeliveryResult } from './channels';
import {deliverOutbox} from './inbox';
import { AgentError } from './contracts';
import { deliverHandoffNotification, handoffKinds } from './telegram-handoff';
type Tx=Prisma.TransactionClient;
export const notificationWake=z.object({notificationId:z.string().min(1).max(80)}).strict();
/** Events are committed with domain changes; delivery is always a separate worker. */
export async function orderNotifications(tx:Tx,orderId:string,kind:'BOOKED'|'CHANGED'|'CANCELLED',event:string,conversationId?:string,ai=false){
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'notifications:'+orderId}))::text`;
  if(await tx.notification.count({where:{eventKey:{startsWith:event+':'}}}))return;
  const order=await tx.order.findUniqueOrThrow({where:{id:orderId}});
  if(order.historical||!['CONFIRMED','SCHEDULED','CANCELLED'].includes(order.status))return;
  const client=await tx.client.findUniqueOrThrow({where:{id:order.clientId}});
  const assignments=await tx.orderCleaner.findMany({where:{orderId},select:{cleanerId:true,removedAt:true}});
  const c=conversationId?await tx.conversation.findUnique({where:{id:conversationId}}):await tx.conversation.findFirst({where:{orderId,clientId:order.clientId,identityVerified:true},orderBy:{lastMessageAt:'desc'}});
  const now=new Date(),start=order.scheduledStart??order.windowFrom;
  const details=`${client.name} · ${start?localInput(start):'Время уточняется'} · ${order.finalPrice??order.basePrice??'—'} RSD · ${c?.channel??order.source}`;
  const title=kind==='CANCELLED'?'Заказ отменён':kind==='CHANGED'?'Заказ изменён':ai?'AI оформила запись клиента':'Новый заказ';
  await tx.notification.updateMany({where:{orderId,kind:{in:['REMINDER','TOMORROW']},deliveryState:'PENDING'},data:{deliveryState:'CANCELLED',status:'CANCELLED'}});
  const records:Prisma.NotificationCreateManyInput[]=[];
  const add=(audience:string,recipient:string,jobKind:string,text:string,scheduledAt=now,external=false)=>records.push({eventKey:`${event}:${audience}:${recipient}:${jobKind}`,orderId,conversationId:c?.id,audience,kind:jobKind,userId:audience==='ADMIN'?recipient:null,clientId:audience==='CLIENT'?client.id:null,cleanerId:audience==='CLEANER'?recipient:null,channel:external?c!.channel:'WEBSITE',text,scheduledAt,payload:{reference:order.reference,date:start?.toISOString()??null,price:String(order.finalPrice??order.basePrice??''),channel:c?.channel??order.source},deliveryState:external||scheduledAt>now?'PENDING':'INTERNAL'});
  const owner=await tx.user.findFirst({where:{active:true,role:'ADMIN'},orderBy:{createdAt:'asc'},select:{id:true}});
  if(owner)add('ADMIN',owner.id,kind,`${title}\n${details}`);
  const settings=await tx.businessSettings.findUniqueOrThrow({where:{id:'default'}});
  const external=!!c&&['TELEGRAM','WHATSAPP','VIBER'].includes(c.channel)&&c.identityVerified&&!!c.externalThreadId&&channelConfiguration(c.channel as CustomerChannel).configured&&!!(settings.customerNotificationChannels as Record<string,boolean>)[c.channel];
  const clientWords=c?.locale==='en'?{BOOKED:'Cleaning confirmed',CHANGED:'Cleaning updated',CANCELLED:'Cleaning cancelled',REMINDER:'Reminder: cleaning tomorrow'}:c?.locale.startsWith('sr')?{BOOKED:'Čišćenje je potvrđeno',CHANGED:'Termin je promenjen',CANCELLED:'Čišćenje je otkazano',REMINDER:'Podsetnik: čišćenje sutra'}:{BOOKED:'Запись подтверждена',CHANGED:'Уборка перенесена / обновлена',CANCELLED:'Уборка отменена',REMINDER:'Напоминание: уборка завтра'};
  add('CLIENT',client.id,kind,`${clientWords[kind]}\n${details}`,now,external);
  const reminder=start?new Date(start.getTime()-86400000):null;
  if(kind!=='CANCELLED'&&reminder&&reminder>now&&['CONFIRMED','SCHEDULED'].includes(order.status))add('CLIENT',client.id,'REMINDER',`${clientWords.REMINDER}\n${details}`,reminder,external);
  for(const a of assignments){
    if(a.removedAt&&kind==='BOOKED')continue;
    add('CLEANER',a.cleanerId,a.removedAt?'CANCELLED':kind,`${a.removedAt?'Назначение снято':title}\n${details}`);
    if(!a.removedAt&&kind!=='CANCELLED'&&reminder&&reminder>now)add('CLEANER',a.cleanerId,'TOMORROW',`Расписание на завтра\n${details}`,reminder);
  }
  await tx.notification.createMany({data:records,skipDuplicates:true});
}
export async function handoffNotification(tx:Tx,conversationId:string,eventId:string,reason:string){
  const owner=await tx.user.findFirst({where:{active:true,role:'ADMIN'},orderBy:{createdAt:'asc'},select:{id:true}});
  if(owner)await tx.notification.upsert({where:{eventKey:`handoff:${eventId}`},create:{eventKey:`handoff:${eventId}`,conversationId,userId:owner.id,audience:'ADMIN',kind:'HANDOFF',channel:'WEBSITE',text:`AI требуется помощь\nПричина: ${reason}`,scheduledAt:new Date(),deliveryState:'INTERNAL',payload:{reason}},update:{}});
  if(owner){
    const c=await tx.conversation.findUniqueOrThrow({where:{id:conversationId},include:{client:{select:{name:true}},lead:{select:{name:true}},messages:{where:{author:'CLIENT'},orderBy:{sentAt:'desc'},take:1,select:{text:true}}}});
    const state=c.state as {name?:unknown}|null;
    const name=c.client?.name??c.lead?.name??(typeof state?.name==='string'?state.name:'Новый клиент');
    const reasons:Record<string,string>={CLIENT_REQUEST:'Клиент попросил оператора',UNCERTAINTY:'Нужно уточнение оператора',TOOL_ERRORS:'Не удалось выполнить действие',PROVIDERS_UNAVAILABLE:'AI временно недоступен',COMPLAINT:'Жалоба клиента',DISCOUNT:'Нестандартная скидка',HAZARDOUS_CLEANING:'Опасные загрязнения',HEAVY_LIFTING:'Перемещение тяжёлой мебели',CREW_PREFERENCE:'Требования к составу команды',ACCESS_REVIEW:'Условия доступа и ключи',PAYMENT_REVIEW:'Уточнение оплаты',CANCELLATION:'Запрос отмены',ARRIVAL_REVIEW:'Уточнение прибытия',OUTSIDE_SERVICE_AREA:'Адрес вне подтверждённой зоны'};
    await tx.notification.upsert({where:{eventKey:`handoff:${eventId}:telegram`},create:{eventKey:`handoff:${eventId}:telegram`,conversationId,userId:owner.id,audience:'ADMIN',kind:'HANDOFF_TELEGRAM',channel:'TELEGRAM',text:`🙋 AI передала клиента человеку\nКлиент: ${name.slice(0,80)}\nПричина: ${reasons[reason]??reason}\n${c.messages[0]?.text.slice(0,500)??''}`,scheduledAt:new Date(),deliveryState:'PENDING',payload:{handoffId:eventId,reason}},update:{}});
  }
}
/** Repeated publishing is harmless. Long reminders are refreshed by daily recovery. */
export async function publishNotifications(db:PrismaClient){
  if(process.env.VERCEL!=='1')return;
  const now=Date.now();
  const rows=await db.notification.findMany({where:{deliveryState:'PENDING',publishedAt:null,scheduledAt:{lte:new Date(now+6*86400000)}},take:100,orderBy:{scheduledAt:'asc'}});
  for(const row of rows){
    try{const due=Math.max(row.scheduledAt.getTime(),row.nextAttemptAt?.getTime()??0);
      await send('lumaclean-notifications',{notificationId:row.id},{idempotencyKey:`${row.id}:${row.attempts}:${Math.floor(now/86400000)}`,delaySeconds:Math.max(0,Math.ceil((due-now)/1000)),retentionSeconds:604800});
      await db.notification.updateMany({where:{id:row.id,deliveryState:'PENDING'},data:{publishedAt:new Date()}});
    }catch{await db.notification.updateMany({where:{id:row.id,deliveryState:'PENDING'},data:{lastErrorCode:'QUEUE_UNAVAILABLE'}});}
  }
}
/** UNKNOWN is terminal: Telegram provides no idempotency key for ambiguous sends. */
export async function deliverNotification(db:PrismaClient,id:string,deliver?:(thread:string,text:string)=>Promise<DeliveryResult>){
  const row=await db.notification.findUnique({where:{id}});if(!row||['INTERNAL','SENT','READ','DELIVERED','CANCELLED','UNKNOWN','FAILED','LEGACY'].includes(row.deliveryState))return;
  const now=new Date();
  if(row.deliveryState==='SENDING'){
    if(row.leaseUntil&&row.leaseUntil<now)await db.notification.updateMany({where:{id,deliveryState:'SENDING',leaseKey:row.leaseKey},data:{deliveryState:'UNKNOWN',status:'FAILED',lastErrorCode:'DELIVERY_OUTCOME_UNKNOWN'}});
    else throw new AgentError('NOTIFICATION_LEASE_ACTIVE');
    return;
  }
  if(row.scheduledAt>now||row.nextAttemptAt&&row.nextAttemptAt>now)throw new AgentError('NOTIFICATION_NOT_DUE');
  const leaseKey=randomUUID();
  const claim=await db.notification.updateMany({where:{id,deliveryState:'PENDING'},data:{deliveryState:'SENDING',leaseKey,leaseUntil:new Date(Date.now()+60000),attempts:{increment:1}}});
  if(!claim.count)throw new AgentError('NOTIFICATION_LEASE_ACTIVE');
  const order=row.orderId?await db.order.findUnique({where:{id:row.orderId}}):null;
  const snapshot=row.payload as {date?:string}|null;
  if(['REMINDER','TOMORROW'].includes(row.kind??'')&&(!order||!['CONFIRMED','SCHEDULED'].includes(order.status)||snapshot?.date!==(order.scheduledStart??order.windowFrom)?.toISOString())){await db.notification.update({where:{id},data:{deliveryState:'CANCELLED',status:'CANCELLED',leaseKey:null,leaseUntil:null}});return;}
  let result:DeliveryResult;
  if(row.channel==='WEBSITE'){
    // Website-only and cleaner jobs are retained internally, never pretend to send SMS.
    await db.notification.update({where:{id},data:{deliveryState:'INTERNAL',leaseKey:null,leaseUntil:null}});return;
  }
  const c=row.conversationId?await db.conversation.findUnique({where:{id:row.conversationId}}):null;
  if(row.audience==='ADMIN'&&handoffKinds.includes(row.kind??'')){
    result=await deliverHandoffNotification(db,id,leaseKey,deliver?async(text)=>deliver(process.env.TELEGRAM_CHAT_ID??'',text):undefined);
    if(result.errorCode==='HANDOFF_CANCELLED')return;
  }
  else{
    const settings=await db.businessSettings.findUniqueOrThrow({where:{id:'default'}});
    if(!c?.identityVerified||c.clientId!==row.clientId||c.channel!==row.channel||!(settings.customerNotificationChannels as Record<string,boolean>)[c.channel]){await db.notification.update({where:{id},data:{deliveryState:'CANCELLED',status:'CANCELLED',leaseKey:null,leaseUntil:null}});return;}
    if(deliver)result=await deliver(c.externalThreadId??'',row.text);
    else{
      const message=await db.message.upsert({where:{conversationId_externalMessageId:{conversationId:c.id,externalMessageId:`notification:${row.id}`}},create:{conversationId:c.id,author:'SYSTEM',text:row.text,externalMessageId:`notification:${row.id}`,deliveryStatus:'PENDING',structured:{notificationId:row.id}},update:{}});
      await deliverOutbox(db,c.id);
      const delivered=await db.message.findUniqueOrThrow({where:{id:message.id}});
      if(['PENDING','SENDING'].includes(delivered.deliveryStatus)){await db.notification.update({where:{id},data:{deliveryState:'PENDING',publishedAt:null,nextAttemptAt:delivered.nextDeliveryAttemptAt??new Date(Date.now()+60000),leaseKey:null,leaseUntil:null}});throw new AgentError('NOTIFICATION_RETRY');}
      result={status:delivered.deliveryStatus as DeliveryResult['status'],errorCode:delivered.deliveryError??undefined};
    }
  }
  const retry=result.status==='FAILED'&&(result.retryable||result.errorCode==='TELEGRAM_RATE_LIMIT')&&row.attempts<4;
  await db.notification.updateMany({where:{id,leaseKey},data:{deliveryState:retry?'PENDING':result.status,status:['SENT','DELIVERED','READ'].includes(result.status)?'SENT':retry?'PENDING':'FAILED',lastErrorCode:result.errorCode??null,sentAt:['SENT','DELIVERED','READ'].includes(result.status)?new Date():null,nextAttemptAt:retry?new Date(Date.now()+Math.min(300000,30000*2**row.attempts)):null,publishedAt:retry?null:row.publishedAt,leaseKey:null,leaseUntil:null}});
  if(['FAILED','UNKNOWN'].includes(result.status)&&c)await db.conversation.updateMany({where:{id:c.id,...(handoffKinds.includes(row.kind??'')?{control:'HUMAN_CONTROL',ownerId:null}:{})},data:{needsAttention:true}});
  if(retry)throw new AgentError('NOTIFICATION_RETRY');
}
export async function recoverNotifications(db:PrismaClient){
  await db.notification.updateMany({where:{deliveryState:'PENDING',publishedAt:{lt:new Date(Date.now()-86400000)},scheduledAt:{lte:new Date(Date.now()+6*86400000)}},data:{publishedAt:null}});
  const due=await db.notification.findMany({where:{OR:[{deliveryState:'PENDING',scheduledAt:{lte:new Date()},OR:[{nextAttemptAt:null},{nextAttemptAt:{lte:new Date()}}]},{deliveryState:'SENDING',leaseUntil:{lt:new Date()}}]},take:100,select:{id:true}});
  for(const row of due){try{await deliverNotification(db,row.id);}catch{/* Durable lease/retry remains in the database. */}}
  await publishNotifications(db);
}
