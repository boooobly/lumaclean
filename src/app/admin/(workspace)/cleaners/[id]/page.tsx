import {cleanerReadiness} from "@/lib/agent/readiness";
import Link from "next/link";
import { getCleaner } from "@/lib/services/scheduling-queries";
import {
  CrmHeader,
  Facts,
  History,
  date,
  money,
} from "@/components/admin/crm-view";
import { getCleanerFinance } from "@/lib/services/finance-queries";
import {
  CleanerForm,
  CleanerActivity,
  AvailabilityEditor,
} from "@/components/admin/scheduling-forms";
import { travelLabels } from "@/lib/domain/scheduling-types";
export const metadata = { title: "Карточка клинера" };
export default async function CleanerDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params,
    c = await getCleaner(id);
  const readiness=cleanerReadiness(c);
  const finance = await getCleanerFinance(id);
  return (
    <>
      <CrmHeader
        title={c.name}
        back="/admin/cleaners"
        subtitle={c.active ? "Активный клинер" : "Неактивный клинер"}
      />
      <div className="crm-detail-grid">
        <section className="crm-section">
          <h2>Контакты и условия</h2><p>Готовность AI: {readiness.ready?"Готов":"Требует настройки"}. Часы: {readiness.hours?"✓":"нет"}; старт: {readiness.address?"✓":"нет"}; координаты: {readiness.coordinates?"✓":"нет"}; active: {readiness.active?"✓":"нет"}; языки: {readiness.languages?"✓":"не заданы"}; payout: {readiness.payout?"✓":"не задан (не блокирует запись)"}.</p>
          <Facts
            items={[
              ["Телефон", c.phone],
              ["Дополнительный контакт", c.additionalContact],
              ["Стартовый адрес", c.homeAddress],
              ["Транспорт", travelLabels[c.defaultTravelMode]],
              ["Языки", c.languages.join(", ")],
              ["Навыки", c.skills.join(", ")],
              ["Рейтинг", c.internalRating?.toString()],
              [
                "Процент",
                c.payoutPercent === null ? "Не задан" : c.payoutPercent + "%",
              ],
              ["Заметки", c.notes],
              ["Создан", date(c.createdAt)],
            ]}
          />
          <details>
            <summary>Редактировать клинера</summary>
            <CleanerForm
              id={id}
              value={{
                name: c.name,
                phone: c.phone,
                additionalContact: c.additionalContact,
                homeAddress: c.homeAddress,
                homeConfirmed:
                  c.homeLatitude !== null && c.homeLongitude !== null,
                languages: c.languages,
                skills: c.skills,
                notes: c.notes,
                defaultTravelMode: c.defaultTravelMode,
                internalRating:
                  c.internalRating === null ? null : Number(c.internalRating),
                payoutPercent:
                  c.payoutPercent === null ? null : Number(c.payoutPercent),
              }}
            />
          </details>
        </section>
        <section className="crm-section">
          <h2>Рабочее планирование</h2>
          <p>
            Исторические назначения сохраняются при деактивации. Новые
            назначения доступны только активным клинерам.
          </p>
          <Link className="crm-button" href={"/admin/calendar?cleanerId=" + id}>
            Расписание клинера →
          </Link>
          <CleanerActivity id={id} active={c.active} />
          <p className="crm-hint">
            Основная логистика — общественный транспорт с пешими участками.
            Подробности маршрутов доступны в календаре.
          </p>
        </section>
      </div>
      <AvailabilityEditor
        key={
          c.updatedAt.toISOString() +
          c.availability.map((r) => r.updatedAt.toISOString()).join()
        }
        id={id}
        rows={c.availability.map((r) => ({
          id: r.id,
          kind: r.kind,
          weekday: r.weekday,
          date: r.date?.toISOString().slice(0, 10) ?? null,
          startMinute: r.startMinute,
          endMinute: r.endMinute,
          reason: r.reason,
        }))}
      />
      <History type="Cleaner" id={id} />
      <section className="crm-section">
        <h2>Финансы клинера</h2>
        <Facts
          items={[
            ["Выполнено заказов", finance.orders],
            ["Выручка заказов с участием клинера", money(finance.revenue)],
            ["Начислено лично клинеру", money(finance.accrued)],
            ["Выплачено", money(finance.paid)],
            ["Ожидает выплаты", money(finance.pending)],
            [
              "Текущий применяемый процент",
              finance.percent === null
                ? "Процент выплаты не настроен"
                : finance.percent + "%",
            ],
          ]}
        />
        <p className="crm-hint">
          Стоимость заказов с участием — оборот бизнеса, а не личный доход
          клинера.
        </p>
      </section>
    </>
  );
}
