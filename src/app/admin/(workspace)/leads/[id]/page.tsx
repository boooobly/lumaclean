import Link from "next/link";
import { getLead, findClientOptions } from "@/lib/services/crm-queries";
import {
  CrmHeader,
  Facts,
  Chip,
  History,
  date,
  money,
} from "@/components/admin/crm-view";
import { CrmForm, Field } from "@/components/admin/crm-form";
import { ClientPicker } from "@/components/admin/crm-fields";
import {
  leadLabels,
  leadTransitions,
  channelLabels,
} from "@/lib/domain/crm-types";
export const metadata = { title: "Карточка заявки" };
export default async function LeadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ clientId?: string }>;
}) {
  const { id } = await params,
    query = await searchParams,
    lead = await getLead(id),
    initial = query.clientId
      ? (await findClientOptions("", query.clientId))[0]
      : undefined;
  return (
    <>
      <CrmHeader
        title={lead.name}
        subtitle={lead.reference ?? "Заявка"}
        back="/admin/leads"
        action={
          !["CONVERTED", "LOST"].includes(lead.status)
            ? { href: `/admin/orders/new?leadId=${id}`, label: "Создать заказ" }
            : undefined
        }
      />
      <div className="crm-detail-grid">
        <section className="crm-section">
          <h2>
            Исходные данные <Chip status={lead.status} />
          </h2>
          <Facts secondary={["Язык", "Канал", "Создана"]} technical={["Нормализованный телефон", "Источник", "Страница входа"]}
            items={[
              ["Имя", lead.name],
              [
                "Телефон",
                <a
                  key="phone"
                  href={`tel:${lead.normalizedPhone ?? lead.phone}`}
                >
                  {lead.phone}
                </a>,
              ],
              [
                "Нормализованный телефон",
                lead.normalizedPhone ?? "Не определён",
              ],
              [
                "Язык",
                (
                  { ru: "Русский", sr: "Сербский", en: "Английский" } as Record<
                    string,
                    string
                  >
                )[lead.locale ?? ""] ?? lead.locale,
              ],
              ["Услуга", lead.service?.name],
              ["Площадь", lead.area ? `${lead.area} м²` : "—"],
              ["Оценка", money(lead.estimatedPrice)],
              ["Срочность", lead.urgent ? "Да" : "Нет"],
              ["Канал", channelLabels[lead.channel]],
              ["Источник", lead.entrySource],
              ["Страница входа", lead.landingPage],
              ["Создана", date(lead.createdAt)],
              [
                "Telegram",
                {
                  SENT: "Уведомление отправлено",
                  FAILED: "Уведомление не доставлено",
                  PENDING: "Доставка не подтверждена",
                  CANCELLED: "Уведомление не требуется",
                }[lead.telegramStatus],
              ],
            ]}
          />
          {lead.extras.length > 0 && (
            <>
              <h3>Дополнительные услуги</h3>
              <ul className="crm-simple-list">
                {lead.extras.map((e) => (
                  <li key={e.id}>
                    {e.extra.name} × {String(e.quantity)}{" "}
                    <span>
                      {money(Number(e.quantity) * Number(e.unitPrice))}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <h3>Комментарий клиента</h3>
          <p className="crm-preserve">{lead.comment || "—"}</p>
          {lead.estimateText && (
            <details>
              <summary>Исходный расчёт с сайта</summary>
              <pre className="crm-estimate">{lead.estimateText}</pre>
            </details>
          )}
          {lead.lostReason && (
            <>
              <h3>Причина закрытия</h3>
              <p className="crm-preserve">{lead.lostReason}</p>
            </>
          )}
        </section>
        <div>
          <section className="crm-section">
            <h2>Работа с заявкой</h2>
            {leadTransitions[lead.status].length > 0 && (
              <CrmForm
                key={lead.status}
                command="lead-status"
                id={id}
                button="Изменить статус"
              >
                <Field
                  name="status"
                  label="Новый статус"
                  value={leadTransitions[lead.status][0]}
                >
                  <>
                    {leadTransitions[lead.status].map((s) => (
                      <option key={s} value={s}>
                        {leadLabels[s]}
                      </option>
                    ))}
                  </>
                </Field>
                <Field
                  name="reason"
                  label="Причина закрытия · для закрытой заявки"
                  type="textarea"
                />
              </CrmForm>
            )}
            <CrmForm command="lead-note" id={id} button="Сохранить заметку">
              <Field
                name="note"
                label="Внутренняя заметка"
                value={lead.internalNote}
                type="textarea"
              />
            </CrmForm>
          </section>
          <section className="crm-section">
            <h2>Клиент и заказы</h2>
            {lead.client ? (
              <p>
                <Link
                  className="admin-text-link"
                  href={`/admin/clients/${lead.client.id}`}
                >
                  {lead.client.name} · {lead.client.phone} →
                </Link>
              </p>
            ) : (
              <p>Клиент пока не связан.</p>
            )}
            {lead.status !== "CONVERTED" && (
              <>
                <CrmForm
                  command="lead-link"
                  id={id}
                  button="Связать с клиентом"
                >
                  <ClientPicker
                    initial={
                      initial
                        ? {
                            ...initial,
                            discountPercent: Number(
                              initial.discountPercent ?? 0,
                            ),
                          }
                        : undefined
                    }
                  />
                </CrmForm>
                <Link
                  className="admin-text-link"
                  href={`/admin/clients/new?leadId=${id}`}
                >
                  Создать нового клиента →
                </Link>
              </>
            )}
            {lead.orders.map((o) => (
              <p key={o.id}>
                <Link
                  className="admin-text-link"
                  href={`/admin/orders/${o.id}`}
                >
                  {o.reference ?? "Заказ"} →
                </Link>{" "}
                <Chip status={o.status} />
              </p>
            ))}
          </section>
        </div>
      </div>
      <History type="Lead" id={id} />
    </>
  );
}
