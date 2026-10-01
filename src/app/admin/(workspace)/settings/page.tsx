import Link from "next/link";
import { CrmHeader } from "@/components/admin/crm-view";
import { Field } from "@/components/admin/crm-form";
import {
  FinanceForm,
  DurationRulesEditor,
} from "@/components/admin/finance-forms";
import { getDurationSettings } from "@/lib/services/finance-queries";
import { AgentModeControl } from "@/components/admin/inbox-controls";
import {AILaunch} from "@/components/admin/ai-launch";
import {readiness} from "@/lib/agent/readiness";
import { getDatabase } from "@/lib/database/client";
export const metadata = { title: "Настройки бизнеса" };
export default async function Settings() {
  const data = await getDurationSettings();
  const ai = await getDatabase().businessSettings.findUniqueOrThrow({where:{id:"default"},});
  const report=await readiness(getDatabase(),ai);
  return (
    <>
      <CrmHeader
        title="Настройки"
        subtitle="Правила длительности и условий выплат."
      />
      <AILaunch checks={report.checks} checkedAt={report.checkedAt} sample={report.shadow} settings={{mode:ai.aiAgentMode,channels:ai.aiChannelModes as Record<string,string>,services:ai.aiAllowedServices,maxMessages:ai.aiMaxAnonymousMessages,maxModelCalls:ai.aiMaxModelCalls,maxToolSteps:ai.aiMaxToolSteps,maxConversationCost:Number(ai.aiMaxConversationCostUsd),dailyWarning:Number(ai.aiDailyCostWarningUsd)}}/><AgentModeControl mode={ai.aiAgentMode} enabled={process.env.AI_AGENT_ENABLED === "true"} canActivate={report.canActivate} blockers={report.blockers.map(c=>`${c.label}: ${c.detail}`)} />
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
