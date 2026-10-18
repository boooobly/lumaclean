import { requireAdmin } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import { localInput } from "@/lib/domain/crm";
import { upholsteryRequestSchema } from "@/lib/upholstery";
import { UpholsteryEditor } from "@/components/admin/upholstery-editor";
import { CrmHeader } from "@/components/admin/crm-view";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { z } from "zod";
import type { upholsterySaveSchema } from "@/lib/services/upholstery-commands";
export const metadata = { title: "Химчистка · расчёт и планирование" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; lead?: string }>;
}) {
  await requireAdmin();
  const { order: id, lead: leadId } = await searchParams,
    db = getDatabase();
  const [settings, clients, crew, o, lead] = await Promise.all([
    db.upholsterySettings.findUniqueOrThrow({ where: { id: "default" } }),
    db.client.findMany({
      orderBy: { name: "asc" },
      take: 300,
      select: {
        id: true,
        name: true,
        addresses: {
          where: { active: true },
          select: { id: true, fullAddress: true },
        },
      },
    }),
    db.cleaner.findMany({
      where: { active: true },
      select: { id: true, name: true },
    }),
    id
      ? db.order.findUnique({
          where: { id },
          include: {
            upholstery: true,
            assignments: { where: { removedAt: null } },
            service: true,
          },
        })
      : null,
    leadId ? db.lead.findUnique({ where: { id: leadId },include:{service:{select:{code:true}}} }) : null,
  ]);
  if ((id && !o) || (leadId && !lead?.upholsteryQuote&&!lead?.upholsteryRequested)) notFound();
  if (lead && !lead.clientId)
    return (
      <>
        <CrmHeader
          title="Сначала выберите клиента"
          back={`/admin/leads/${lead.id}`}
        />
        <p>
          Свяжите заявку с существующим клиентом или создайте клиента и адрес в
          её карточке.
        </p>
        <Link className="crm-button" href={`/admin/leads/${lead.id}`}>
          Открыть заявку
        </Link>
      </>
    );
  const u = o?.upholstery;
  const leadInput = lead?.upholsteryQuote
    ? upholsteryRequestSchema.parse(
        (lead.upholsteryQuote as { input: unknown }).input,
      )
    : null;
  if (lead && leadInput?.mode === "ADDON" && !leadInput.cleaning && !o) {
    const orders = await db.order.findMany({
      where: {
        clientId: lead.clientId!,
        historical: false,
        status: { in: ["DRAFT", "CONFIRMED", "SCHEDULED"] },
        upholstery: { is: null },
        service: { code: { not: "upholstery" } },
      },
      orderBy: { scheduledStart: "asc" },
      take: 50,
    });
    return (
      <>
        <CrmHeader
          title="Выберите основную уборку"
          back={`/admin/leads/${lead.id}`}
        />
        <p>
          Заявка на дополнение к уже заказанной уборке. Выберите заказ этого
          клиента; его согласованная цена сохранится.
        </p>
        {orders.map((order) => (
          <p key={order.id}>
            <Link
              className="crm-button"
              href={`/admin/orders/upholstery?order=${order.id}&lead=${lead.id}`}
            >
              {order.reference ?? order.id} ·{" "}
              {order.scheduledStart
                ? localInput(order.scheduledStart)
                : "Дата не назначена"}
            </Link>
          </p>
        ))}
        {!orders.length && (
          <p>
            Открытой уборки не найдено. Уточните, нужен ли отдельный выезд, или
            сначала создайте основную уборку.
          </p>
        )}
      </>
    );
  }
  let initial: Partial<z.infer<typeof upholsterySaveSchema>> | undefined;
  if (o)
    initial = {
      orderId: o.id,
      leadId: lead?.id,
      cleaningMinutes:
        o.service?.code === "upholstery"
          ? null
          : u
            ? ((
                u.cleaningBaseline as {
                  manualDurationMinutes: number | null;
                  estimatedDurationMinutes: number | null;
                } | null
              )?.manualDurationMinutes ??
              (
                u.cleaningBaseline as {
                  estimatedDurationMinutes: number | null;
                } | null
              )?.estimatedDurationMinutes ??
              null)
            : (o.manualDurationMinutes ?? o.estimatedDurationMinutes),
      clientId: o.clientId,
      addressId: o.addressId,
      expectedUpdatedAt: o.updatedAt.toISOString(),
      finalPrice: u ? Number(o.finalPrice) : null,
      priceReason: u
        ? (o.priceChangeReason ?? "Сохранить ранее согласованные условия")
        : "",
      request: leadInput
        ? { ...leadInput, cleaning: undefined, mode: "ADDON", urgent: o.urgent }
        : u
          ? upholsteryRequestSchema.parse(u.input)
          : {
              mode: "ADDON",
              items: [
                {
                  type: "SOFA3",
                  quantity: 1,
                  soil: "NORMAL",
                  fabric: "UNKNOWN",
                  material: "",
                  size: "standard",
                  notes: "",
                },
              ],
              urgent: o.urgent,
            },
      scheduledStart: o.scheduledStart ? localInput(o.scheduledStart) : "",
      cleanerIds: o.assignments.map((a) => a.cleanerId),
      approve: u?.reviewStatus === "APPROVED",
      reviewNote: u?.reviewNote ?? "",
      photos: Array.isArray(u?.photos) ? (u.photos as string[]) : [],
      plannedMinutes: u?.plannedMinutes ?? null,
      preparationMinutes: u?.preparationMinutes ?? null,
      cleanupMinutes: u?.cleanupMinutes ?? null,
      transferMinutes: u?.transferMinutes ?? null,
      equipmentUnit: u?.equipmentUnit ?? null,
      equipmentCleanerId: u?.equipmentCleanerId ?? null,
      logisticsNote: u?.logisticsNote ?? "",
      patchTestConfirmed: u?.patchTestConfirmed ?? false,
    };
  else if (lead) {
    initial = {
      leadId: lead.id,
      clientId: lead.clientId!,
      addressId:
        clients.find((c) => c.id === lead.clientId)?.addresses[0]?.id ?? "",
      ...(leadInput?{request:leadInput}:lead.requestKind==='CLEANING_UPHOLSTERY'&&lead.service&&lead.area?{request:{mode:'ADDON' as const,items:[],urgent:lead.urgent,cleaning:{service:lead.service.code as 'regular'|'deep'|'move'|'airbnb'|'office',area:Number(lead.area)}}}: {request:{mode:'STANDALONE' as const,items:[],urgent:false}}),
    };
  }
  return (
    <>
      <CrmHeader
        title="Химчистка мягкой мебели"
        back={o ? `/admin/orders/${o.id}` : "/admin/orders"}
        subtitle="Цена по предметам, проверка ткани и планирование аппарата."
      />
      {lead && (
        <p>
          Заявка: {lead.name ?? "Имя не указано"} · {lead.phone}. Создание свяжет только эту заявку
          и выбранный заказ.
        </p>
      )}
      <UpholsteryEditor
        clients={clients}
        crew={crew}
        catalogVersion={settings.version}
        extractorQuantity={settings.extractorQuantity}
        initial={initial}
      />
    </>
  );
}
