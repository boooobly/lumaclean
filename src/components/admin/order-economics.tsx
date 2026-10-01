import { getOrderEconomics } from "@/lib/services/finance-queries";
import { money, Facts } from "./crm-view";
import { Field } from "./crm-form";
import { FinanceForm } from "./finance-forms";
import { localInput } from "@/lib/domain/crm";
export async function OrderEconomics({
  id,
  price,
  updatedAt,
  historical,
  actual,
  planned,
  ruleVersion,
  overrideReason,
}: {
  id: string;
  price: number;
  updatedAt: string;
  historical: boolean;
  actual: number | null;
  planned: number | null;
  ruleVersion: number | null;
  overrideReason: string | null;
}) {
  const data = await getOrderEconomics(id);
  return (
    <section className="crm-section">
      <h2>Экономика заказа</h2>
      <Facts
        items={[
          ["Доход", money(data.revenue)],
          ["Начислено клинерам", money(data.accrued)],
          ["Прямые расходы", money(data.businessExpenses)],
          ["Остаток LumaClean", money(data.profit)],
        ]}
      />
      {data.missing.map((m) => (
        <p className="crm-hint" key={m.name}>
          {m.name}:{" "}
          {m.configured
            ? "начисление требует отдельного запуска"
            : "Процент выплаты не настроен"}
          .
        </p>
      ))}
      {!historical && data.missing.some((m) => m.configured) && (
        <details>
          <summary>Начислить отсутствующие выплаты</summary>
          <p>Уже созданные начисления сохраняются.</p>
          <FinanceForm
            command="payout-create-missing"
            payload={{ orderId: id }}
            confirm
            button="Создать отсутствующие начисления"
          >
            <Field
              name="reason"
              label="Причина отдельного начисления"
              required
            />
          </FinanceForm>
        </details>
      )}
      {historical && (
        <p className="schedule-issues">
          Excel import · legacy ID. Исторический резерв 15% и расчётные выплаты
          не являются правилами новой модели. Остаток показан до подтверждения
          старых выплат.
        </p>
      )}
      <details>
        <summary>Корректировка цены завершённого заказа</summary>
        <p>
          Выплаты сохранят свои суммы. Пересчёт выполняется отдельной операцией
          в финансах.
        </p>
        <FinanceForm
          command="order-price"
          payload={{ id, expectedUpdatedAt: updatedAt }}
          confirm
          button="Исправить финальную цену"
        >
          <Field
            name="finalPrice"
            label="Финальная цена, RSD"
            type="number"
            value={price}
            min={0}
            max={10000000}
            step={0.01}
            required
          />
          <Field name="reason" label="Причина корректировки" required />
        </FinanceForm>
      </details>
      <h3>Точность планирования</h3>
      <Facts
        items={[
          [
            "Плановая длительность",
            planned === null ? "Не задана" : planned + " мин",
          ],
          [
            "Фактическая длительность",
            actual === null
              ? "Нет полного фактического времени"
              : actual + " мин",
          ],
          [
            "Версия правила",
            ruleVersion === null
              ? "Ручное / историческое планирование"
              : "v" + ruleVersion,
          ],
          ["Причина ручной длительности", overrideReason],
        ]}
      />
      {data.assignments.map((a) => (
        <details key={a.id}>
          <summary>{a.name} · фактическое время</summary>
          <FinanceForm
            command="assignment-time"
            payload={{ id: a.id, orderId: id }}
          >
            <Field
              name="startedAt"
              label="Фактическое начало · Белград"
              type="datetime-local"
              value={localInput(a.startedAt)}
              required
            />
            <Field
              name="finishedAt"
              label="Фактическое окончание · Белград"
              type="datetime-local"
              value={localInput(a.finishedAt)}
              required
            />
            <Field
              name="reason"
              label="Источник / причина корректировки"
              required
            />
          </FinanceForm>
        </details>
      ))}
      {data.legacy && (
        <details>
          <summary>Исходные финансовые значения Excel</summary>
          <pre className="finance-legacy">
            {JSON.stringify(data.legacy, null, 2)}
          </pre>
        </details>
      )}
    </section>
  );
}
