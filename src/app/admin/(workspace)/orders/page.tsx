import Link from "next/link";
import { listOrders } from "@/lib/services/crm-queries";
import {
  CrmHeader,
  Ledger,
  Filters,
  Pager,
  Chip,
  date,
  money,
} from "@/components/admin/crm-view";
import type { Query } from "@/lib/domain/crm-filters";
export const metadata = { title: "Заказы" };
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  const query = await searchParams,
    data = await listOrders(query);
  return (
    <>
      <CrmHeader
        title="Заказы"
        subtitle="Согласованные уборки, время и зафиксированная стоимость."
        action={{ href: "/admin/orders/new", label: "Создать заказ" }}
      />
      <Filters kind="orders" query={query} />
      <Ledger
        secondary={["Длительность"]}
        headers={[
          "Заказ / создан",
          "Клиент / адрес",
          "Услуга / площадь",
          "Время уборки",
          "Длительность",
          "Цена / статус",
        ]}
        empty={
          !data.rows.length
            ? data.q || Object.keys(query).length
              ? "Ничего не найдено"
              : "Заказов пока нет"
            : undefined
        }
      >
        {data.rows.map((r) => (
          <tr key={r.id}>
            <td>
              <Link className="crm-row-link" href={`/admin/orders/${r.id}`}>
                {r.reference ?? r.id}
              </Link>
              <small>{date(r.createdAt)}</small>
            </td>
            <td>
              <Link href={`/admin/clients/${r.client.id}`}>
                {r.client.name}
              </Link>
              <small>{r.address.fullAddress}</small>
            </td>
            <td>
              {r.service.name}
              <small>{String(r.area)} м²</small>
            </td>
            <td>
              {date(r.scheduledStart ?? r.windowFrom)}
              <small>
                {r.scheduleMode === "FLEXIBLE"
                  ? `Окно до ${date(r.windowTo)}`
                  : "Точное время"}
              </small>
            </td>
            <td>
              {r.estimatedDurationMinutes
                ? `${r.estimatedDurationMinutes} мин`
                : "Не рассчитано"}
              {r.manualDurationMinutes && (
                <small>Вручную: {r.manualDurationMinutes} мин</small>
              )}
            </td>
            <td>
              {money(r.finalPrice, r.currency)}
              <small>
                <Chip status={r.status} />
              </small>
            </td>
          </tr>
        ))}
      </Ledger>
      <Pager {...data} query={query} path="/admin/orders" />
    </>
  );
}
