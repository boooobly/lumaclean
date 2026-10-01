import { getLead, findClientOptions } from "@/lib/services/crm-queries";
import { CrmHeader } from "@/components/admin/crm-view";
import { OrderForm } from "@/components/admin/crm-fields";
import { localInstant, localInput } from "@/lib/domain/crm";
import type { ServiceId, extrasPrices } from "@/lib/pricing";
export const metadata = { title: "Новый заказ" };
export default async function NewOrder({
  searchParams,
}: {
  searchParams: Promise<{
    leadId?: string;
    clientId?: string;
    scheduledStart?: string;
  }>;
}) {
  const query = await searchParams,
    lead = query.leadId ? await getLead(query.leadId) : null,
    clientId = query.clientId ?? lead?.clientId;
  const client = clientId
    ? (await findClientOptions("", clientId))[0]
    : undefined;
  let scheduledStart: string | undefined;
  if (typeof query.scheduledStart === "string") {
    try {
      scheduledStart = localInput(localInstant(query.scheduledStart));
    } catch {}
  }
  return (
    <>
      <CrmHeader
        title="Создать заказ"
        back="/admin/orders"
        subtitle={
          lead
            ? `Из заявки ${lead.reference}. Проверьте контакты, адрес, время и цену.`
            : "Заполните условия уборки. Заказ создаётся как черновик."
        }
      />
      <OrderForm
        leadId={lead?.id}
        initialClient={
          client
            ? {
                ...client,
                discountPercent: Number(client.discountPercent ?? 0),
              }
            : undefined
        }
        clientValues={lead ? { name: lead.name, phone: lead.phone } : undefined}
        value={
          lead
            ? {
                ...(scheduledStart
                  ? { scheduleMode: "FIXED", scheduledStart }
                  : {}),
                service: lead.service?.code as ServiceId,
                area: Number(lead.area ?? 55),
                urgent: lead.urgent,
                clientComment: lead.comment,
                extras: lead.extras.map((e) => ({
                  code: e.extra.code as keyof typeof extrasPrices,
                  quantity: Number(e.quantity),
                })),
              }
            : scheduledStart
              ? { scheduleMode: "FIXED", scheduledStart }
              : undefined
        }
      />
    </>
  );
}
