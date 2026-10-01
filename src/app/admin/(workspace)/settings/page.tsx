import Link from "next/link";
import { CrmHeader } from "@/components/admin/crm-view";
import { Field } from "@/components/admin/crm-form";
import {
  FinanceForm,
  DurationRulesEditor,
} from "@/components/admin/finance-forms";
import { getDurationSettings } from "@/lib/services/finance-queries";
export const metadata = { title: "Настройки бизнеса" };
export default async function Settings() {
  const data = await getDurationSettings();
  return (
    <>
      <CrmHeader
        title="Настройки"
        subtitle="Правила длительности и условий выплат."
      />
      <section className="crm-section">
        <h2>Основные правила</h2>
        <dl className="crm-facts">
          <div>
            <dt>Часовой пояс</dt>
            <dd>{data.timezone}</dd>
          </div>
          <div>
            <dt>Валюта</dt>
            <dd>{data.currency}</dd>
          </div>
          <div>
            <dt>Транспортный буфер</dt>
            <dd>{data.travelBufferMinutes} минут</dd>
          </div>
        </dl>
      </section>
      <section className="crm-section">
        <h2>Выплаты клинерам</h2>
        <p>
          База — финальная цена заказа до общих расходов бизнеса. Процент
          каждого клинера применяется отдельно. Индивидуальное значение в
          карточке клинера имеет приоритет.
        </p>
        <FinanceForm
          key={data.defaultPercent ?? "empty"}
          command="settings"
          payload={{}}
        >
          <Field
            name="defaultCleanerPayoutPercent"
            label="Процент по умолчанию · можно оставить пустым"
            value={data.defaultPercent}
            type="number"
            min={0}
            max={100}
            step={0.01}
          />
        </FinanceForm>
        <p className="crm-hint">
          Пустое значение не создаёт автоматических начислений. Изменение
          процента действует на будущие завершения; готовые выплаты сохраняют
          снимок.
        </p>
      </section>
      <DurationRulesEditor rules={data.rules} services={data.services} />
      <section className="crm-section">
        <h2>Импорт данных</h2>
        <p>
          Legacy LumaClean workbook: сначала preview, затем явное применение
          выбранных строк.
        </p>
        <Link className="crm-button" href="/admin/settings/import">
          Открыть импорт →
        </Link>
      </section>
    </>
  );
}
