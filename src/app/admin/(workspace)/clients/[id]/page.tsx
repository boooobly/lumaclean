import Link from "next/link";
import { getClient } from "@/lib/services/crm-queries";
import {
  CrmHeader,
  Facts,
  History,
  Chip,
  date,
  money,
} from "@/components/admin/crm-view";
import { CrmForm } from "@/components/admin/crm-form";
import { ClientFields, AddressFields } from "@/components/admin/crm-fields";
import { channelLabels } from "@/lib/domain/crm-types";
export const metadata = { title: "Карточка клиента" };
export default async function ClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params,
    { client: c, stats, last } = await getClient(id);
  return (
    <>
      <CrmHeader
        title={c.name}
        back="/admin/clients"
        subtitle={`Клиент с ${date(c.createdAt)}`}
        action={{
          href: `/admin/orders/new?clientId=${id}`,
          label: "Создать заказ",
        }}
      />
      <div className="crm-detail-grid">
        <section className="crm-section">
          <h2>Контакты и условия</h2>
          <Facts secondary={["Telegram", "WhatsApp", "Viber", "Предпочитаемый канал", "Индивидуальные условия", "Заметки"]} technical={["Нормализованный"]}
            items={[
              [
                "Телефон",
                c.phone ? (
                  <a key="tel" href={`tel:${c.normalizedPhone ?? c.phone}`}>
                    {c.phone}
                  </a>
                ) : "Телефон не указан",
              ],
              ["Нормализованный", c.normalizedPhone ?? "Не определён"],
              ["Telegram", c.telegram],
              ["WhatsApp", c.whatsapp],
              ["Viber", c.viber],
              [
                "Предпочитаемый канал",
                c.preferredChannel
                  ? channelLabels[c.preferredChannel]
                  : "Не указан",
              ],
              ["Скидка", `${c.discountPercent ?? 0}%`],
              ["Индивидуальные условия", c.individualTerms],
              ["Заметки", c.notes],
            ]}
          />
          <details>
            <summary>Редактировать клиента</summary>
            <CrmForm command="client-update" id={id}>
              <ClientFields
                value={{
                  ...c,
                  discountPercent: Number(c.discountPercent ?? 0),
                }}
              />
            </CrmForm>
          </details>
        </section>
        <section className="crm-section">
          <h2>История в цифрах</h2>
          <Facts
            items={[
              ["Всего заказов", c._count.orders],
              ["Завершено", stats._count],
              ["Выручка", money(stats._sum.finalPrice ?? 0)],
              ["Средний чек", money(stats._avg.finalPrice)],
              ["Последняя уборка", date(last?.historicalServiceDate ?? last?.completedAt, !!last?.historicalServiceDate)],
            ]}
          />
        </section>
      </div>
      <section className="crm-section">
        <h2>
          Адреса <small>{c._count.addresses}</small>
        </h2>
        {c.addresses.length === 0 && (
          <p className="crm-hint">Добавьте первый адрес для создания заказа.</p>
        )}
        <div className="crm-addresses">
          {c.addresses.map((a) => (
            <article
              key={a.id}
              className={`crm-address ${a.active ? "" : "crm-address-inactive"}`}
            >
              <header>
                <h3>{a.label ?? "Адрес"}</h3>
                <span>{a.active ? "Активен" : "Не используется"}</span>
              </header>
              <p>{a.fullAddress}</p><p className="crm-hint">{a.coordinatesConfirmed ? (a.coordinatesSource === "MANUAL_ADMIN_MAP" ? "Точка подтверждена владельцем на карте" : "Координаты подтверждены") : "Координаты не подтверждены"}</p>
              <Facts
                items={[
                  ["Квартира", a.apartment],
                  ["Этаж", a.floor],
                  ["Домофон", a.intercom],
                  ["Комментарий", a.comment],
                ]}
              />
              <details>
                <summary>Редактировать адрес</summary>
                <CrmForm command="address-update" id={a.id} clientId={id}>
                  <AddressFields value={{label:a.label,fullAddress:a.fullAddress,coordinatesConfirmed:a.coordinatesConfirmed,apartment:a.apartment,floor:a.floor,intercom:a.intercom,comment:a.comment,latitude:a.latitude===null?null:Number(a.latitude),longitude:a.longitude===null?null:Number(a.longitude)}} />
                </CrmForm>
              </details>
              <CrmForm
                command="address-active"
                id={a.id}
                clientId={id}
                active={!a.active}
                button={
                  a.active ? "Деактивировать адрес" : "Активировать адрес"
                }
                compact
              />
            </article>
          ))}
        </div>
        <details className="crm-add-address">
          <summary>＋ Добавить адрес</summary>
          <CrmForm
            command="address-create"
            clientId={id}
            button="Добавить адрес"
          >
            <AddressFields />
          </CrmForm>
        </details>
      </section>
      <div className="crm-detail-grid">
        <section className="crm-section">
          <h2>Заявки</h2>
          {!c.leads.length && (
            <p className="crm-hint">Связанных заявок пока нет.</p>
          )}
          <ul className="crm-linked-list">
            {c.leads.map((l) => (
              <li key={l.id}>
                <Link href={`/admin/leads/${l.id}`}>
                  {l.reference ?? "Заявка"}
                  <small>{date(l.createdAt)}</small>
                </Link>
                <Chip status={l.status} />
              </li>
            ))}
          </ul>
          {c._count.leads > 20 && (
            <Link
              className="admin-text-link"
              href={`/admin/leads?clientId=${id}`}
            >
              Все заявки →
            </Link>
          )}
        </section>
        <section className="crm-section">
          <h2>Заказы</h2>
          {!c.orders.length && <p className="crm-hint">Заказов пока нет.</p>}
          <ul className="crm-linked-list">
            {c.orders.map((o) => (
              <li key={o.id}>
                <Link href={`/admin/orders/${o.id}`}>
                  {o.reference ?? "Заказ"}
                  <small>
                    {date(o.historicalServiceDate ?? o.scheduledStart ?? o.windowFrom, !!o.historicalServiceDate)} ·{" "}
                    {money(o.finalPrice, o.currency)} · {o.historicalServiceLabel ?? o.service?.name ?? "Услуга не указана"} · {String(o.area)} м² {o.historical && "· Исторический заказ"}
                  </small>
                </Link>
                <Chip status={o.status} />
              </li>
            ))}
          </ul>
          {c._count.orders > 20 && (
            <Link
              className="admin-text-link"
              href={`/admin/orders?clientId=${id}`}
            >
              Все заказы →
            </Link>
          )}
        </section>
      </div>
      <History type="Client" id={id} />
    </>
  );
}
