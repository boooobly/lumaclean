import { createHash, randomUUID } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import { websiteLeadSchema } from "@/lib/validation/crm";
import { normalizedPhone, CrmError } from "@/lib/domain/crm";
import { quote } from "@/lib/domain/crm-pricing";
import {serviceDatePolicy,buildAgentTemporalContext} from "@/lib/agent/temporal";
import { writeAudit } from "./audit";
import {enqueueLeadReview} from './lead-notifications';
import {limitNewWebsiteLead} from './lead-rate-limit';
import {publishNotifications,deliverNotification} from '@/lib/agent/notifications';
export async function saveWebsiteLead(db: PrismaClient, payload: unknown, source?: string) {
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
      if(source)await limitNewWebsiteLead(tx,source);
      if(input.urgent){const settings=await tx.businessSettings.findUniqueOrThrow({where:{id:'default'}}),now=new Date();const date=buildAgentTemporalContext(now,settings,now).nowLocalDate;if('error' in serviceDatePolicy(date,settings,now))throw new CrmError('VALIDATION','SAME_DAY_CUTOFF');}
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
        input.urgent,
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
          requestKind,upholsteryRequested,humanReviewRequired:upholsteryRequested,consentAt:new Date(),
          serviceId: service.id,
          area: standalone?null:input.area,
          estimatedPrice: calculated?.total??null,
          urgent: input.urgent,
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
      await enqueueLeadReview(tx,{...lead,service:input.service,area:input.area,estimatedPrice:calculated?.total??null});
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
  workers = {publish:publishNotifications,deliver:deliverNotification},
) {
  // Retain the public helper signature for callers; all delivery goes through the outbox.
  void input; void send;
  try{
    await workers.publish(db);
    const event=await db.notification.findUnique({where:{eventKey:`website-lead:${lead.id}:telegram`}});
    // The same leased worker can deliver after the HTTP response if the queue is down.
    if(event?.deliveryState==='PENDING'&&!event.publishedAt&&event.lastErrorCode==='QUEUE_UNAVAILABLE')await workers.deliver(db,event.id);
  }catch{/* Recovery reads committed PENDING rows. */}
}
