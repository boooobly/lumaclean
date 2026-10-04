import Link from "next/link";
import { listLeads } from "@/lib/services/crm-queries";
import {
  CrmHeader,
  Ledger,
  Filters,
  Pager,
  Chip,
  date,
  money,
} from "@/components/admin/crm-view";
import { CrmForm } from "@/components/admin/crm-form";
import { channelLabels, leadTransitions } from "@/lib/domain/crm-types";
import type { Query } from "@/lib/domain/crm-filters";
export const metadata = { title: "Заявки" };
export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  const query = await searchParams,
    data = await listLeads(query);
  return (
    <>
      <CrmHeader
        title="Заявки"
        subtitle="Обращения с сайта и других каналов. От первого ответа до согласованного заказа."
        action={{ href: "/admin/leads/new", label: "Добавить заявку" }}
      />
      <Filters kind="leads" query={query} />
      <Ledger
        headers={[
          "Заявка / дата",
          "Контакт",
          "Услуга / оценка",
          "Канал / статус",
          "Клиент",
          "Действия",
        ]}
        empty={
          !data.rows.length
            ? data.count
              ? "На этой странице записей нет"
              : data.q || Object.keys(query).length
                ? "Ничего не найдено"
                : "Заявок пока нет"
            : undefined
        }
      >
        {data.rows.map((r) => (
          <tr key={r.id}>
            <td>
              <Link className="crm-row-link" href={`/admin/leads/${r.id}`}>
                {r.reference ?? r.id}
              </Link>
              <small>{date(r.createdAt)}</small>
            </td>
            <td>
              {r.name}
              <small>{r.phone}</small>
            </td>
            <td>
              {r.service?.name ?? "—"}
              <small>{money(r.estimatedPrice)}</small>
            </td>
            <td>
              <Chip status={r.status} />
              <small>{channelLabels[r.channel]}</small>
            </td>
            <td>
              {r.client ? (
                <Link href={`/admin/clients/${r.client.id}`}>
                  {r.client.name}
                </Link>
              ) : (
                "—"
              )}
            </td>
            <td>
              <div className="crm-row-actions">
                <Link href={`/admin/leads/${r.id}`}>Открыть →</Link>
                {["IN_PROGRESS", "WAITING_CLIENT"]
                  .filter((s) =>
                    (leadTransitions[r.status] as readonly string[]).includes(
                      s,
                    ),
                  )
                  .map((s) => (
                    <CrmForm
                      command="lead-status"
                      id={r.id}
                      compact
                      key={s}
                      button={s === "IN_PROGRESS" ? "В работу" : "Ждём клиента"}
                    >
                      <input type="hidden" name="status" value={s} />
                    </CrmForm>
                  ))}
              </div>
            </td>
          </tr>
        ))}
      </Ledger>
      <Pager {...data} query={query} path="/admin/leads" />
    </>
  );
}
