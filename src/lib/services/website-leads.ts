import { createHash, randomUUID } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import { websiteLeadSchema } from "@/lib/validation/crm";
import { normalizedPhone, CrmError, serviceLabels } from "@/lib/domain/crm";
import { quote } from "@/lib/domain/crm-pricing";
import {serviceDatePolicy,buildAgentTemporalContext} from "@/lib/agent/temporal";
import { writeAudit } from "./audit";
export async function saveWebsiteLead(db: PrismaClient, payload: unknown) {
  const input = websiteLeadSchema.parse(payload);
  input.extras = input.extras
    .filter((e) => e.quantity > 0)
    .sort((a, b) => a.code.localeCompare(b.code));
  const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
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
      if(input.urgent){const settings=await tx.businessSettings.findUniqueOrThrow({where:{id:'default'}}),now=new Date();const date=buildAgentTemporalContext(now,settings,now).nowLocalDate;if('error' in serviceDatePolicy(date,settings,now))throw new CrmError('VALIDATION','SAME_DAY_CUTOFF');}
      const service = await tx.service.findUnique({
        where: { code: input.service },
        select: { id: true, active: true },
      });
      if (!service?.active)
        throw new CrmError("VALIDATION", "Service unavailable");
      const calculated = quote(
        input.service,
        input.area,
        input.extras,
        input.urgent,
      );
      const catalogue = await tx.serviceExtra.findMany({
        where: { code: { in: input.extras.map((e) => e.code) }, active: true },
        select: { id: true, code: true },
      });
      if (catalogue.length !== input.extras.length)
        throw new CrmError("VALIDATION", "Extra unavailable");
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
          serviceId: service.id,
          area: input.area,
          estimatedPrice: calculated.total,
          urgent: input.urgent,
          comment: input.comment,
          estimateText: input.estimate,
          entrySource: input.attribution?.source,
          landingPage: input.attribution?.landing,
          channel: "WEBSITE",
          extras: {
            create: calculated.extras.map((e) => ({
              extraId: catalogue.find((c) => c.code === e.code)!.id,
              quantity: e.quantity,
              unitPrice: e.unitPrice,
            })),
          },
        },
      });
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
  let sent = false;
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN,
      chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) throw new Error("unconfigured");
    const text = [
      "🧹 Новая заявка LumaClean",
      `Номер: ${lead.reference}`,
      `Имя: ${input.name}`,
      `Телефон: ${input.phone}`,
      `Язык: ${input.locale}`,
      `Услуга: ${serviceLabels[input.service]}`,
      `Площадь: ${input.area} м²`,
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
