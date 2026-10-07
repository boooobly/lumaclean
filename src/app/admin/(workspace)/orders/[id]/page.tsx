import Link from "next/link";
import { getOrderPlanning } from "@/lib/services/scheduling-queries";
import { OrderPlanningPanel } from "@/components/admin/order-planning";
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
import { OrderEconomics } from "@/components/admin/order-economics";
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
  const planning = o.historical ? null : await getOrderPlanning(id);
  return (
    <>
      <CrmHeader
        title={o.reference ?? "Заказ"}
        back="/admin/orders"
        subtitle={(o.historicalServiceLabel ?? o.service?.name ?? "Услуга не указана")}
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
            {o.historical ? "Исторический заказ" : "Уборка"} <Chip status={o.status} />
          </h2>
          <Facts secondary={["Загрязнение", "Срочность", "Ручная длительность", "Причина ручной длительности", "Режим времени", "Завершён"]} technical={["Версия расчёта", "Происхождение"]}
            items={o.historical ? [["Дата уборки", date(o.historicalServiceDate ?? o.completedAt, !!o.historicalServiceDate)], ["Услуга", o.historicalServiceLabel ?? o.service?.name], ["Площадь", `${o.area} м²`], ["Источник", `Excel · заказ ${o.legacyId}`]] : [
              ["Услуга", (o.historicalServiceLabel ?? o.service?.name ?? "Услуга не указана")],
              ["Площадь", `${o.area} м²`],
              ["Загрязнение", o.soilLevel ? soilLabels[o.soilLevel] : "—"],
              ["Срочность", o.urgent ? "Да" : "Нет"],
              [
                "Клинеров необходимо",
                o.historical ? "Команда не восстановлена" : o.requiredCleaners,
              ],
              [
                "Версия расчёта",
                o.durationRuleVersion === null
                  ? "Не настроено"
                  : "v" + o.durationRuleVersion,
              ],
              ["Причина ручной длительности", o.durationOverrideReason],
              [
                "Происхождение",
                o.historical
                  ? "Excel import · legacy ID " + o.legacyId
                  : "Рабочий заказ",
              ],
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
                  o.client.phone ? (
                    <a key="tel" href={`tel:${o.client.phone}`}>
                      {o.client.phone}
                    </a>
                  ) : "Телефон не указан",
                ],
                ["Telegram", o.client.telegram],
                ["WhatsApp", o.client.whatsapp],
                ["Viber", o.client.viber],
                ["Адрес", o.address.fullAddress],
                ["Координаты", o.address.coordinatesConfirmed ? "Подтверждены" : "Не подтверждены"],
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
            <h2>{o.historical ? "Доход по источнику" : "Цена · зафиксированный прайс"}</h2>
            <Facts
              items={o.historical ? [["Доход", money(o.finalPrice, o.currency)]] : [
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
      {planning && <OrderPlanningPanel
        order={planning.order}
        cleaners={planning.cleaners}
        overrides={planning.overrides.map((r) => ({
          id: r.id,
          reason: r.reason,
          createdAt: r.createdAt.toISOString(),
          name: r.user.name,
        }))}
      />}
      {o.status === "COMPLETED" && (
        <OrderEconomics
          id={id}
          price={Number(o.finalPrice)}
          updatedAt={o.updatedAt.toISOString()}
          historical={o.historical}
          planned={o.manualDurationMinutes ?? o.estimatedDurationMinutes}
          actual={o.actualDurationMinutes}
          ruleVersion={o.durationRuleVersion}
          overrideReason={o.durationOverrideReason}
        />
      )}
      <History type="Order" id={id} />
      {planning && <RoutingWorkspace
        date={(
          planning.order.localStart ||
          planning.order.windowFrom ||
          new Date().toISOString()
        ).slice(0, 10)}
        order={planning.order}
        cleaners={planning.cleaners}
      />}
    </>
  );
}
import { RoutingWorkspace } from "@/components/admin/routing-workspace";
