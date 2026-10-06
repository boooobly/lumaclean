import { DisclosureSection } from "@/components/admin/disclosure";
import { cleanerDay } from "@/lib/domain/cleaner-day";
import {cleanerReadiness} from "@/lib/agent/readiness";
import Link from "next/link";
import { listCleaners } from "@/lib/services/scheduling-queries";
import { CrmHeader, Ledger, Pager, date } from "@/components/admin/crm-view";
import { travelLabels } from "@/lib/domain/scheduling-types";
import { scalar, type Query } from "@/lib/domain/crm-filters";
export const metadata = { title: "Клинеры" };
export default async function CleanersPage({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  const raw = await searchParams,
    q = {
      q: scalar(raw, "q"),
      active: scalar(raw, "active"),
      page: scalar(raw, "page"),
    },
    data = await listCleaners(q);
  return (
    <>
      <CrmHeader
        title="Клинеры"
        subtitle="Команда, рабочие часы и индивидуальные условия."
        action={{ href: "/admin/cleaners/new", label: "Добавить клинера" }}
      />
      <DisclosureSection title="Поиск и фильтры"><form className="crm-filters" method="GET">
        <label>
          Поиск
          <input
            type="search"
            name="q"
            defaultValue={q.q ?? ""}
            placeholder="Имя или телефон"
          />
        </label>
        <label>
          Активность
          <select name="active" defaultValue={q.active ?? ""}>
            <option value="">Все клинеры</option>
            <option value="yes">Активные</option>
            <option value="no">Неактивные</option>
          </select>
        </label>
        <button className="crm-button">Найти</button>
        <Link href="/admin/cleaners">Сбросить</Link>
      </form></DisclosureSection>
      <Ledger
        headers={[
          "Клинер",
          "Телефон",
          "Транспорт",
          "Языки",
          "Процент",
          "Активность",
          "Готовность AI",
        ]}
        empty={!data.rows.length ? "Клинеров пока нет" : undefined}
      >
        {data.rows.map((c) => (
          <tr key={c.id}>
            <td>
              <Link className="crm-row-link" href={"/admin/cleaners/" + c.id}>
                {c.name}
              </Link>
              <small>{cleanerDay(c.active,c.availability)}</small>
              {c.assignments[0] && <small><Link href={`/admin/orders/${c.assignments[0].order.id}`}>{date(c.assignments[0].order.scheduledStart)} · {c.assignments[0].order.client.name} →</Link></small>}
            </td>
            <td><a href={`tel:${c.phone}`}>{c.phone}</a></td>
            <td><details><summary>Подробнее</summary>{travelLabels[c.defaultTravelMode]}</details></td>
            <td><details><summary>Языки</summary>{c.languages.join(", ") || "—"}</details></td>
            <td>
              {(c.payoutPercent ?? data.defaultPercent) === null
                ? "Процент выплаты не настроен"
                : String(c.payoutPercent ?? data.defaultPercent) + "%"}
            </td>
            <td>{c.active ? "Активен" : "Неактивен"}</td><td><CleanerChecklist cleaner={c}/><Link href={"/admin/cleaners/"+c.id}>Настроить →</Link></td>
          </tr>
        ))}
      </Ledger>
      <Pager {...data} query={q} path="/admin/cleaners" />
    </>
  );
}

function CleanerChecklist({cleaner}:{cleaner:Parameters<typeof cleanerReadiness>[0]}){const r=cleanerReadiness(cleaner);return <div><b>{r.ready?"Готов":"Нужна настройка"}</b><details><summary>Подробнее</summary><ul>{[["Контакты",r.contact],["Активен",r.active],["График",r.hours],["Адрес",r.address],["Координаты",r.coordinates]].map(([label,ok])=><li key={String(label)}>{label} {ok?"✓":"✕"}</li>)}</ul></details></div>;}

