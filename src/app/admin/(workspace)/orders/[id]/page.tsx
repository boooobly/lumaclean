import Link from "next/link";
import { getOrder } from "@/lib/services/crm-queries";
import {
  CrmHeader,
  Facts,
  Chip,
  History,
  date,
  money,
} from "@/components/admin/crm-view";
import { CrmForm, Field } from "@/components/admin/crm-form";
import {
  orderLabels,
  orderTransitions,
  soilLabels,
  channelLabels,
} from "@/lib/domain/crm-types";
export const metadata = { title: "Карточка заказа" };
export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params,
    o = await getOrder(id),
    editable = !["COMPLETED", "CANCELLED", "NO_SHOW"].includes(o.status);
  return (
    <>
      <CrmHeader
        title={o.reference ?? "Заказ"}
        back="/admin/orders"
        subtitle={o.service.name}
        action={
          editable
            ? {
                href: `/admin/orders/${id}/edit`,
                label: "Редактировать / перенести",
              }
            : undefined
        }
      />
      <div className="crm-detail-grid">
        <section className="crm-section">
          <h2>
            Уборка <Chip status={o.status} />
          </h2>
          <Facts
            items={[
              ["Услуга", o.service.name],
              ["Площадь", `${o.area} м²`],
              ["Загрязнение", o.soilLevel ? soilLabels[o.soilLevel] : "—"],
              ["Срочность", o.urgent ? "Да" : "Нет"],
              ["Клинеров необходимо", o.requiredCleaners],
              [
                "Расчётная длительность",
                o.estimatedDurationMinutes
                  ? `${o.estimatedDurationMinutes} мин`
                  : "Не рассчитано",
              ],
              [
                "Ручная длительность",
                o.manualDurationMinutes
                  ? `${o.manualDurationMinutes} мин`
                  : "Не указана",
              ],
              [
                "Режим времени",
                o.scheduleMode === "FIXED" ? "Точное время" : "Гибкое окно",
              ],
              ["Начало", date(o.scheduledStart ?? o.windowFrom)],
              ["Конец окна", date(o.windowTo)],
              ["Завершён", date(o.completedAt)],
            ]}
          />
          <h3>Дополнительные услуги</h3>
          {o.extras.length ? (
            <ul className="crm-simple-list">
              {o.extras.map((e) => (
                <li key={e.id}>
                  {e.extra.name} × {String(e.quantity)}
                  <span>{money(Number(e.unitPrice) * Number(e.quantity))}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="crm-hint">Не выбраны.</p>
          )}
          <h3>Комментарии</h3>
          <Facts
            items={[
              ["От клиента", o.clientComment],
              ["Внутренний", o.internalComment],
              ["Причина отмены", o.cancellationReason],
            ]}
          />
        </section>
        <div>
          <section className="crm-section">
            <h2>Клиент и адрес</h2>
            <Facts
              items={[
                [
                  "Клиент",
                  <Link
                    className="admin-text-link"
                    key="client"
                    href={`/admin/clients/${o.client.id}`}
                  >
                    {o.client.name} →
                  </Link>,
                ],
                [
                  "Телефон",
                  <a key="tel" href={`tel:${o.client.phone}`}>
                    {o.client.phone}
                  </a>,
                ],
                ["Telegram", o.client.telegram],
                ["WhatsApp", o.client.whatsapp],
                ["Viber", o.client.viber],
                ["Адрес", o.address.fullAddress],
                [
                  "Квартира / этаж",
                  [o.address.apartment, o.address.floor]
                    .filter(Boolean)
                    .join(" / ") || "—",
                ],
                ["Домофон", o.address.intercom],
                ["Комментарий адреса", o.address.comment],
                ["Источник", channelLabels[o.source]],
                [
                  "Заявка",
                  o.lead ? (
                    <Link
                      className="admin-text-link"
                      key="lead"
                      href={`/admin/leads/${o.lead.id}`}
                    >
                      {o.lead.reference} →
                    </Link>
                  ) : (
                    "Вручную"
                  ),
                ],
              ]}
            />
          </section>
          <section className="crm-section">
            <h2>Цена · зафиксированный прайс</h2>
            <Facts
              items={[
                [
                  "Расчёт с дополнениями и срочностью",
                  money(o.basePrice, o.currency),
                ],
                [
                  "Скидка",
                  `${o.discountPercent}% · ${money(o.discountAmount, o.currency)}`,
                ],
                ["Изменение владельца", money(o.priceAdjustment, o.currency)],
                [
                  "Финальная цена",
                  <strong key="price" className="crm-total">
                    {money(o.finalPrice, o.currency)}
                  </strong>,
                ],
                ["Причина изменения", o.priceChangeReason],
              ]}
            />
          </section>
          {orderTransitions[o.status].length > 0 && (
            <section className="crm-section">
              <h2>Изменить статус</h2>
              <CrmForm
                key={o.status}
                command="order-status"
                id={id}
                button="Подтвердить изменение"
              >
                <Field
                  name="status"
                  label="Новый статус"
                  value={orderTransitions[o.status][0]}
                >
                  <>
                    {orderTransitions[o.status].map((s) => (
                      <option key={s} value={s}>
                        {orderLabels[s]}
                      </option>
                    ))}
                  </>
                </Field>
                <Field
                  name="reason"
                  label="Причина · обязательна для отмены и неявки"
                  type="textarea"
                />
              </CrmForm>
            </section>
          )}
        </div>
      </div>
      <History type="Order" id={id} />
    </>
  );
}
