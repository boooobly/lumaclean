import type {Prisma} from '@/generated/prisma/client';
import {requestKindLabels,type RequestKind} from '@/lib/lead-intent';
import {serviceLabels} from '@/lib/domain/crm';
import type {ServiceId} from '@/lib/pricing';
export function websiteLeadNotificationText(lead:{id:string;reference:string|null;name:string;phone:string;requestKind:string;service?:ServiceId;area?:number;estimatedPrice:number|null;comment?:string|null}){
  const combined=lead.requestKind==='CLEANING_UPHOLSTERY';
  return ['Новая заявка LumaClean',`Услуга: ${requestKindLabels[lead.requestKind as RequestKind]}`,combined&&lead.service?`Уборка: ${serviceLabels[lead.service]}, ${lead.area} м²`:null,combined&&lead.estimatedPrice!==null?`Расчёт уборки: ${lead.estimatedPrice} RSD (без химчистки)`:null,'Химчистка: требуется уточнение',`Клиент: ${lead.name}\nКонтакт: ${lead.phone}`,lead.comment?`Комментарий: ${lead.comment}`:null,`Открыть заявку → ${new URL(`/admin/leads/${encodeURIComponent(lead.id)}`,process.env.NEXT_PUBLIC_SITE_URL??'https://lumacleanrs.com').href}`].filter(Boolean).join('\n');
}
export async function enqueueLeadReview(tx:Prisma.TransactionClient,lead:Parameters<typeof websiteLeadNotificationText>[0]){
  const owner=await tx.user.findFirst({where:{active:true,role:'ADMIN'},orderBy:{createdAt:'asc'},select:{id:true}});
  if(!owner)return;
  await tx.notification.upsert({where:{eventKey:`website-lead:${lead.id}:telegram`},create:{eventKey:`website-lead:${lead.id}:telegram`,userId:owner.id,channel:'TELEGRAM',audience:'ADMIN',kind:'WEBSITE_LEAD',text:websiteLeadNotificationText(lead),payload:{leadId:lead.id},scheduledAt:new Date(),deliveryState:'PENDING'},update:{}});
}
