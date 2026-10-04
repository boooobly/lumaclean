import { CrmHeader } from "@/components/admin/crm-view";
import { getDurationAnalytics } from "@/lib/services/finance-queries";
import { AIAnalytics } from "@/components/admin/ai-analytics";
export const metadata = { title: "Точность планирования" };
export default async function Analytics() {
  const data = await getDurationAnalytics();
  return (
    <>
      <CrmHeader
        title="Аналитика"
        subtitle="Точность планирования · только завершённые заказы с фактическим временем."
      />
      <AIAnalytics />
      <section className="crm-section">
        <h2>Плановая и фактическая длительность</h2>
        <p>
          Наблюдений: <strong>{Math.min(10000, data.count)}</strong>
          {data.capped ? " · последние 10 000" : null}. Фактическая длительность
          — от первого старта до последнего окончания всех активных назначений.
          Часы участников из Excel не считаются фактической длительностью
          заказа.
        </p>
        {data.groups.length ? (
          <div className="admin-table-shell">
            <table className="crm-ledger">
              <thead>
                <tr>
                  <th>Услуга / диапазон</th>
                  <th>n</th>
                  <th>Средняя ошибка</th>
                  <th>Абсолютная ошибка</th>
                  <th>Недооценка / переоценка</th>
                </tr>
              </thead>
              <tbody>
                {data.groups.map((g) => (
                  <tr key={g.group}>
                    <td>
                      {g.group}
                      {g.recommendation && <p>{g.recommendation}</p>}
                      {g.n < 8 && (
                        <small>
                          Наблюдений мало; параметры автоматически не меняются.
                        </small>
                      )}
                    </td>
                    <td>{g.n}</td>
                    <td>
                      {g.meanError > 0 ? "+" : ""}
                      {Math.round(g.meanError)} мин
                    </td>
                    <td>{Math.round(g.meanAbsoluteError)} мин</td>
                    <td>
                      {g.underestimated} / {g.overestimated}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="crm-hint">
            Наблюдений пока нет. Внесите фактическое время каждого назначения в
            карточке завершённого заказа.
          </p>
        )}
        <p className="crm-hint">
          Положительная ошибка означает недооценку. Рекомендации появляются при
          n ≥ 8 и среднем отклонении от 15 минут; правило меняет только
          администратор.
        </p>
      </section>
    </>
  );
}
