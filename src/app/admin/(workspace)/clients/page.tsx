import Link from "next/link";
import { listClients } from "@/lib/services/crm-queries";
import {
  CrmHeader,
  Ledger,
  Filters,
  Pager,
  date,
  money,
} from "@/components/admin/crm-view";
import { channelLabels } from "@/lib/domain/crm-types";
import type { Query } from "@/lib/domain/crm-filters";
export const metadata = { title: "Клиенты" };
export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  const query = await searchParams,
    data = await listClients(query);
  return (
    <>
      <CrmHeader
        title="Клиенты"
        subtitle="Контакты, адреса и история уборок. Один клиент — несколько пространств."
        action={{ href: "/admin/clients/new", label: "Добавить клиента" }}
      />
      <Filters kind="clients" query={query} />
      <Ledger
        secondary={["Создан", "Выручка / завершённые"]}
        headers={[
          "Клиент",
          "Телефон / канал",
          "Заказы",
          "Последний заказ",
          "Выручка / завершённые",
          "Создан",
        ]}
        empty={
          !data.rows.length
            ? data.q || Object.keys(query).length
              ? "Ничего не найдено"
              : "Клиентов пока нет"
            : undefined
        }
      >
        {data.rows.map((r) => (
          <tr key={r.id}>
            <td>
              <Link className="crm-row-link" href={`/admin/clients/${r.id}`}>
                {r.name}
              </Link>
            </td>
            <td>
              {r.phone ?? "Телефон не указан"}
              <small>
                {r.preferredChannel
                  ? channelLabels[r.preferredChannel]
                  : "Канал не указан"}
              </small>
            </td>
            <td>{r._count.orders}</td>
            <td>
              {date(
                r.orders[0]?.historicalServiceDate ?? r.orders[0]?.scheduledStart ??
                  r.orders[0]?.windowFrom ??
                  r.orders[0]?.createdAt, !!r.orders[0]?.historicalServiceDate,
              )}
            </td>
            <td>{money(r.revenue ?? 0)}</td>
            <td>{date(r.createdAt)}</td>
          </tr>
        ))}
      </Ledger>
      <Pager {...data} query={query} path="/admin/clients" />
    </>
  );
}
