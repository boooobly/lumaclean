import { createHash, randomUUID } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import { websiteLeadSchema } from "@/lib/validation/crm";
import { normalizedPhone, CrmError, serviceLabels } from "@/lib/domain/crm";
import { quote } from "@/lib/domain/crm-pricing";
import {websiteDatePolicy, preferredTimeLabels} from '@/lib/domain/website-preferences';
import { writeAudit } from "./audit";
import {enqueueLeadReview} from './lead-notifications';
import {publishNotifications} from '@/lib/agent/notifications';
export async function saveWebsiteLead(db: PrismaClient, payload: unknown, now = new Date()) {
  const input = websiteLeadSchema.parse(payload);
  input.extras = input.extras
    .filter((e) => e.quantity > 0)
    .sort((a, b) => a.code.localeCompare(b.code));
  const {requestKind,upholsteryRequested,...legacy}=input;
  const hash = createHash("sha256").update(JSON.stringify(requestKind==='CLEANING'?legacy:input)).digest("hex");
  if(!normalizedPhone(input.phone))throw new CrmError('VALIDATION','INVALID_PHONE');
  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`website:${input.submissionId}`}))::text`;
      const existing = await tx.lead.findUnique({
        where: { submissionId: input.submissionId },
        select: { id: true, reference: true, submissionHash: true },
      });
      if (existing) {
        if (existing.submissionHash !== hash)
          throw new CrmError(
            "IDEMPOTENCY",
            "Submission ID already used for another payload",
          );
        return {
          id: existing.id,
          reference: existing.reference!,
          created: false,
        };
      }
      const settings=await tx.businessSettings.findUniqueOrThrow({where:{id:'default'}});
      const datePolicy=websiteDatePolicy(input,settings,now);
      if('error' in datePolicy && datePolicy.error) throw new CrmError('VALIDATION',datePolicy.error);
      const urgent=datePolicy.urgent;
      const standalone=requestKind==='UPHOLSTERY';
      const service = await tx.service.findUnique({
        where: { code: standalone?'upholstery':input.service! },
        select: { id: true, active: true },
      });
      if (!service?.active)
        throw new CrmError("VALIDATION", "Service unavailable");
      const calculated = standalone?null:quote(
        input.service!,
        input.area!,
        input.extras,
        urgent,
      );
      const catalogue = await tx.serviceExtra.findMany({
        where: { code: { in: input.extras.map((e) => e.code) }, active: true },
        select: { id: true, code: true,unitPrice:true },
      });
      if (catalogue.length !== input.extras.length)
        throw new CrmError("VALIDATION", "Extra unavailable");
      if(calculated?.extras.some(e=>!catalogue.some(item=>item.code===e.code&&Number(item.unitPrice)===e.unitPrice)))throw new CrmError('VALIDATION','Price catalog requires verification');
      const reference = `LC-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
      const lead = await tx.lead.create({
        data: {
          reference,
          submissionId: input.submissionId,
          submissionHash: hash,
          name: input.name,
          phone: input.phone,
          normalizedPhone: normalizedPhone(input.phone),
          locale: input.locale,
          requestKind,upholsteryRequested,humanReviewRequired:upholsteryRequested||input.soilLevel==='HEAVY',consentAt:new Date(),
          preferredDate:input.preferredDate?new Date(`${input.preferredDate}T00:00:00Z`):null,
          preferredTime:input.preferredTime,
          preferredChannel:input.preferredChannel,
          soilLevel:input.soilLevel,
          serviceId: service.id,
          area: standalone?null:input.area,
          estimatedPrice: input.soilLevel==='HEAVY'?null:calculated?.total??null,
          urgent,
          comment: input.comment,
          estimateText: input.estimate,
          entrySource: input.attribution?.source,
          landingPage: input.attribution?.landing,
          channel: "WEBSITE",
          extras: {
            create: (calculated?.extras??[]).map((e) => ({
              extraId: catalogue.find((c) => c.code === e.code)!.id,
              quantity: e.quantity,
              unitPrice: e.unitPrice,
            })),
          },
        },
      });
      if(upholsteryRequested)await enqueueLeadReview(tx,{...lead,service:input.service,area:input.area,estimatedPrice:calculated?.total??null});
      await writeAudit(
        tx,
        { type: "SYSTEM", key: "website-intake" },
        { action: "LEAD_CREATED", entityType: "Lead", entityId: lead.id },
      );
      return { id: lead.id, reference, created: true };
    },
    { maxWait: 10000, timeout: 30000 },
  );
}
export async function notifyWebsiteLead(
  db: PrismaClient,
  lead: { id: string; reference: string },
  input: ReturnType<typeof websiteLeadSchema.parse>,
  send: typeof fetch = fetch,
) {
  if(input.upholsteryRequested){try{await publishNotifications(db);}catch{/* Durable pending notification is recovered by the existing worker. */}return;}
  let sent = false;
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN,
      chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) throw new Error("unconfigured");
    const text = [
      "🧹 Новая заявка LumaClean",
      `Номер: ${lead.reference}`,
      input.name ? `Имя: ${input.name}` : 'Имя не указано',
      `Телефон: ${input.phone}`,
      `Язык: ${input.locale}`,
      `Услуга: ${serviceLabels[input.service!]}`,
      `Площадь: ${input.area} м²`,
      `Желаемая дата (Белград): ${input.preferredDate??'Уточнить позже'} — не подтверждённая бронь`,
      input.preferredTime?`Предпочтение по времени: ${preferredTimeLabels[input.preferredTime]} (не интервал прибытия)`:'',
      input.preferredChannel?`Способ связи: ${input.preferredChannel}`:'',
      input.soilLevel==='HEAVY'?'Сильное/нестандартное загрязнение: цена требует согласования':'',
      input.attribution
        ? `Источник (по браузеру): ${input.attribution.source}\nСтраница входа: ${input.attribution.landing}`
        : "Источник: не определён",
      input.comment ? `Комментарий: ${input.comment}` : "",
      input.estimate ?? "",
    ]
      .filter(Boolean)
      .join("\n");
    const response = await send(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      },
    );
    const body = await response.json().catch(() => null);
    sent = response.ok && body?.ok === true;
  } catch {
    /* Persisted lead is the source of truth. Never log contacts, URLs or errors. */
  }
  if (!sent)
    console.error(
      JSON.stringify({
        level: "error",
        msg: "lead_delivery_failed",
        route: "/api/lead",
        leadReference: lead.reference,
      }),
    );
  try {
    await db.lead.update({
      where: { id: lead.id },
      data: { telegramStatus: sent ? "SENT" : "FAILED" },
    });
  } catch {
    console.error(
      JSON.stringify({
        level: "error",
        msg: "lead_notification_status_failed",
        route: "/api/lead",
      }),
    );
  }
}
