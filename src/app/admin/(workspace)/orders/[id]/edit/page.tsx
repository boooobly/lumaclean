import { getOrder, findClientOptions } from "@/lib/services/crm-queries";
import { CrmHeader } from "@/components/admin/crm-view";
import { OrderForm } from "@/components/admin/crm-fields";
import { localInput } from "@/lib/domain/crm";
import type { ServiceId, extrasPrices } from "@/lib/pricing";
export const metadata = { title: "Редактировать заказ" };
export default async function EditOrder({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params,
    o = await getOrder(id),
    client = (await findClientOptions("", o.clientId))[0];
  if (client && !client.addresses.some((a) => a.id === o.addressId))
    client.addresses.push({
      id: o.addressId,
      label: o.address.label,
      fullAddress: o.address.fullAddress,
    });
  return (
    <>
      <CrmHeader
        title="Изменить заказ"
        back={`/admin/orders/${id}`}
        subtitle={`${o.reference} · ${o.client.name} · ${o.address.fullAddress}`}
      />
      {["COMPLETED", "CANCELLED", "NO_SHOW"].includes(o.status) ? (
        <p>Закрытый заказ доступен только для просмотра.</p>
      ) : (
        <OrderForm
          id={id}
          addressId={o.addressId}
          initialClient={
            client
              ? { ...client, discountPercent: Number(o.discountPercent) }
              : undefined
          }
          value={{
            service: o.service.code as ServiceId,
            area: Number(o.area),
            soilLevel: o.soilLevel ?? "NORMAL",
            urgent: o.urgent,
            extras: o.extras.map((e) => ({
              code: e.extra.code as keyof typeof extrasPrices,
              quantity: Number(e.quantity),
            })),
            requiredCleaners: o.requiredCleaners,
            manualDurationMinutes: o.manualDurationMinutes,
            scheduleMode: o.scheduleMode,
            scheduledStart: localInput(o.scheduledStart),
            windowFrom: localInput(o.windowFrom),
            windowTo: localInput(o.windowTo),
            basePrice: Number(o.basePrice),
            discountPercent: Number(o.discountPercent),
            finalPrice: o.finalPrice !== null ? Number(o.finalPrice) : null,
            priceChangeReason: o.priceChangeReason,
            clientComment: o.clientComment,
            internalComment: o.internalComment,
          }}
        />
      )}
    </>
  );
}
