import { z } from "zod";
import { randomUUID, createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { upholsteryRequestSchema } from "@/lib/upholstery";
import { publicUpholsteryQuote } from "./upholstery-commands";
import { CrmError, normalizedPhone } from "@/lib/domain/crm";
import { writeAudit } from "./audit";
import {enqueueLeadReview} from './lead-notifications';
import {quote as cleaningQuote} from '@/lib/domain/crm-pricing';
import {leadAttributionSchema} from '@/lib/validation/lead-attribution';
import {publicLeadPaths} from '@/lib/public-paths';
export const upholsteryLeadSchema = z
  .object({
    submissionId: z.uuid(),
    name: z.string().trim().min(2).max(100),
    phone: z
      .string()
      .trim()
      .min(6)
      .max(40)
      .refine((v) => !!normalizedPhone(v)),
    locale: z.enum(["ru", "sr", "en"]),
    consent: z.literal(true),
    request: upholsteryRequestSchema,
    requestedDate: z.iso.date().optional(),
    comment: z.string().trim().max(1500).default(""),
    attribution: leadAttributionSchema.refine(value => publicLeadPaths.includes(value.landing), 'Unknown public landing page').optional(),
  })
  .strict();
export async function saveUpholsteryLead(db: PrismaClient, payload: unknown) {
  const v = upholsteryLeadSchema.parse(payload),
    hash = createHash("sha256").update(JSON.stringify(v)).digest("hex"),
    quote = await publicUpholsteryQuote(db, {
      request: v.request,
      ...(v.requestedDate ? { requestedDate: v.requestedDate } : {}),
    });
  if (quote.materialRejected)
    throw new CrmError(
      "VALIDATION",
      "Материал не допускает влажную экстракцию. Нужен другой метод или индивидуальная консультация.",
    );
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`website:${v.submissionId}`}))::text`;
    const old = await tx.lead.findUnique({
      where: { submissionId: v.submissionId },
    });
    if (old) {
      if (old.submissionHash !== hash)
        throw new CrmError(
          "IDEMPOTENCY",
          "Запрос уже отправлен с другими условиями",
        );
      return { id: old.id, reference: old.reference! };
    }
    const service = await tx.service.findUniqueOrThrow({
      where: { code: "upholstery" },
    });
    if (!service.active) throw new CrmError("VALIDATION", "Услуга отключена");
    const lead = await tx.lead.create({
      data: {
        submissionId: v.submissionId,
        submissionHash: hash,
        reference: `UP-LEAD-${randomUUID().slice(0, 8).toUpperCase()}`,
        name: v.name,
        phone: v.phone,
        normalizedPhone: normalizedPhone(v.phone),
        locale: v.locale,
        entrySource: v.attribution?.source,
        landingPage: v.attribution?.landing,
        requestKind:v.request.mode==='STANDALONE'?'UPHOLSTERY':'CLEANING_UPHOLSTERY',upholsteryRequested:true,humanReviewRequired:true,consentAt:new Date(),
        channel: "WEBSITE",
        serviceId: service.id,
        urgent: quote.surcharge > 0,
        estimatedPrice: quote.total,
        comment: v.requestedDate
          ? `Желаемая дата: ${v.requestedDate} (Europe/Belgrade).\n${v.comment}`
          : v.comment,
        upholsteryQuote: JSON.parse(
          JSON.stringify({
            input: { ...v.request, urgent: quote.surcharge > 0 },
            quote,
            requestedDate: v.requestedDate ?? null,
          }),
        ) as Prisma.InputJsonValue,
        telegramStatus: "PENDING",
      },
    });
    await enqueueLeadReview(tx,{...lead,requestKind:v.request.mode==='STANDALONE'?'UPHOLSTERY':'CLEANING_UPHOLSTERY',service:v.request.cleaning?.service,area:v.request.cleaning?.area,estimatedPrice:v.request.cleaning?cleaningQuote(v.request.cleaning.service,v.request.cleaning.area,[],quote.surcharge>0).total:null});
    await writeAudit(
      tx,
      { type: "SYSTEM", key: "upholstery-intake" },
      {
        action: "UPHOLSTERY_LEAD_CREATED",
        entityType: "Lead",
        entityId: lead.id,
      },
    );
    return { id: lead.id, reference: lead.reference! };
  });
}
