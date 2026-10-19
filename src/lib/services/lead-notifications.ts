import type {Prisma} from '@/generated/prisma/client';
import {requestKindLabels,type RequestKind} from '@/lib/lead-intent';
import {serviceLabels} from '@/lib/domain/crm';
import type {ServiceId} from '@/lib/pricing';
export function websiteLeadNotificationText(lead:{id:string;reference:string|null;name:string|null;phone:string;requestKind:string;service?:ServiceId;area?:number;estimatedPrice:number|null;comment?:string|null;locale?:string|null;estimateText?:string|null;entrySource?:string|null;landingPage?:string|null}){
  const contact=lead.requestKind==='CONTACT_REQUEST',upholstery=['UPHOLSTERY','CLEANING_UPHOLSTERY'].includes(lead.requestKind);
  return ['Новая заявка LumaClean',`Номер: ${lead.reference}`,`Услуга: ${contact?'Обратный звонок':requestKindLabels[lead.requestKind as RequestKind]}`,
    lead.service?`Уборка: ${serviceLabels[lead.service]}, ${lead.area} м²`:null,
    lead.estimatedPrice!==null?`Расчёт уборки: ${lead.estimatedPrice} RSD${upholstery?' (без химчистки)':''}`:null,
    upholstery?'Химчистка: требуется уточнение':null,contact?'Услуга и площадь пока не указаны.':null,
    `Клиент: ${lead.name??'Имя не указано'}\nКонтакт: ${lead.phone}`,lead.locale?`Язык: ${lead.locale}`:null,
    lead.entrySource?`Источник (по браузеру): ${lead.entrySource}\nСтраница входа: ${lead.landingPage}`:null,
    lead.comment?`Комментарий: ${lead.comment}`:null,
    `Открыть заявку → ${new URL(`/admin/leads/${encodeURIComponent(lead.id)}`,process.env.NEXT_PUBLIC_SITE_URL??'https://lumacleanrs.com').href}`,
    lead.estimateText,
  ].filter(Boolean).join('\n');
}
export async function enqueueLeadReview(tx:Prisma.TransactionClient,lead:Parameters<typeof websiteLeadNotificationText>[0]){
  const owner=await tx.user.findFirst({where:{active:true,role:'ADMIN'},orderBy:{createdAt:'asc'},select:{id:true}});
  // Keep the durable event even if no active admin exists yet.
  await tx.notification.upsert({where:{eventKey:`website-lead:${lead.id}:telegram`},create:{eventKey:`website-lead:${lead.id}:telegram`,userId:owner?.id,channel:'TELEGRAM',audience:'ADMIN',kind:'WEBSITE_LEAD',text:websiteLeadNotificationText(lead),payload:{leadId:lead.id},scheduledAt:new Date(),deliveryState:'PENDING'},update:{}});
}
