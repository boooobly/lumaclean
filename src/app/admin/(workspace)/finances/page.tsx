import Link from "next/link";
import { CrmHeader, Facts, money } from "@/components/admin/crm-view";
import { Field } from "@/components/admin/crm-form";
import { ExpenseFields, FinanceForm } from "@/components/admin/finance-forms";
import { getFinances } from "@/lib/services/finance-queries";
import { expenseLabels, payoutLabels } from "@/lib/domain/finance";
import { CrmError } from "@/lib/domain/crm";
export const metadata = { title: "Финансы и выплаты" };
export default async function Finances({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams,
    input = Object.fromEntries(
      Object.entries(raw).map(([k, v]) => [
        k,
        typeof v === "string" ? v : undefined,
      ]),
    );
  let data;
  try {
    data = await getFinances(input);
  } catch (e) {
    if (e instanceof CrmError)
      return (
        <>
          <CrmHeader title="Финансы" />
          <p role="alert">{e.message}</p>
          <Link href="/admin/finances">Текущий месяц →</Link>
        </>
      );
    throw e;
  }
  const orders = data.orderOptions;
  const date = (iso: string) =>
    new Intl.DateTimeFormat("ru-RU", {
      timeZone: "Europe/Belgrade",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(iso));
  return (
    <>
      <CrmHeader
        title="Финансы"
        subtitle={`${data.period.fromLabel} — ${data.period.toLabel} · RSD · Europe/Belgrade`}
        action={{ href: "/admin/settings/import", label: "Импорт истории" }}
      />
      <form className="finance-period" method="get">
        <label>
          Период
          <select name="period" defaultValue={input.period ?? "month"}>
            <option value="month">Текущий месяц</option>
            <option value="previous">Предыдущий месяц</option>
            <option value="year">Год</option>
            <option value="custom">Произвольный диапазон</option>
          </select>
        </label>
        <label>
          От
          <input
            type="date"
            name="from"
            defaultValue={input.from ?? data.period.fromLabel}
          />
        </label>
        <label>
          До
          <input
            type="date"
            name="to"
            defaultValue={input.to ?? data.period.toLabel}
          />
        </label>
        <button className="crm-button">Показать</button>
      </form>
      <div className="finance-metrics">
        {[
          ["Выручка", money(data.revenue)],
          ["Расходы бизнеса", money(data.expenses)],
          ["Начислено клинерам", money(data.accrued)],
          ["Операционная прибыль", money(data.profit)],
          ["Завершённых заказов", data.orderCount],
          ["Средний чек", money(data.average)],
        ].map(([label, value]) => (
          <div key={String(label)}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <p className="crm-hint">
        Выручка и начисления относятся к дате завершения заказа, расходы — к
        дате операции. Черновики и отменённые заказы не входят в выручку.
        Связанный Expense выплаты повторно не вычитается.
      </p>
      {data.missing > 0 && (
        <aside className="schedule-issues">
          {data.missing} завершённых заказов без полного начисления. Процент
          выплаты не настроен или начисление требует отдельного запуска в
          карточке заказа.
        </aside>
      )}
      {data.legacyUnreviewed > 0 && (
        <aside className="schedule-issues">
          Для {data.legacyUnreviewed} исторических заказов legacy выплаты
          требуют подтверждения. Показанная прибыль не учитывает эти
          неподтверждённые выплаты и может быть завышена.
        </aside>
      )}
      <nav className="finance-links" aria-label="Разделы финансов">
        <a href="#expenses">Расходы</a>
        <a href="#payouts">Выплаты</a>
        <a href="#trends">Динамика</a>
        <Link href="/admin/settings">Проценты и правила →</Link>
      </nav>
      <section className="crm-section" id="expenses">
        <h2>
          Расходы <small>{data.expenseCount} за период</small>
        </h2>
        <details>
          <summary>Добавить расход</summary>
          <FinanceForm command="expense-create">
            <ExpenseFields orders={orders} />
          </FinanceForm>
        </details>
        {data.expenseRows.length ? (
          <div className="admin-table-shell">
            <table className="crm-ledger">
              <thead>
                <tr>
                  <th>Дата / категория</th>
                  <th>Описание / заказ</th>
                  <th>Сумма</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {data.expenseRows.map((e) => (
                  <tr key={e.id}>
                    <td>
                      {date(e.occurredAt)}
                      <br />
                      <small>{expenseLabels[e.category]}</small>
                    </td>
                    <td>
                      {e.description}
                      {e.orderId && (
                        <>
                          <br />
                          <Link href={"/admin/orders/" + e.orderId}>
                            {orders.find((o) => o.id === e.orderId)
                              ?.reference ?? "Заказ"}{" "}
                            →
                          </Link>
                        </>
                      )}
                    </td>
                    <td>{money(e.amount)}</td>
                    <td>
                      <details>
                        <summary>Изменить</summary>
                        <FinanceForm
                          command="expense-update"
                          payload={{ id: e.id, expectedUpdatedAt: e.updatedAt }}
                        >
                          <ExpenseFields value={e} orders={orders} />
                        </FinanceForm>
                        <FinanceForm
                          command="expense-delete"
                          payload={{ id: e.id, expectedUpdatedAt: e.updatedAt }}
                          button="Удалить расход"
                          confirm
                        >
                          <Field
                            name="reason"
                            label="Причина удаления"
                            required
                          />
                        </FinanceForm>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="crm-hint">Расходов за этот период нет.</p>
        )}
      </section>
      <section className="crm-section" id="payouts">
        <h2>
          Выплаты <small>{data.payoutCount} начислений</small>
        </h2>
        <p>
          Выплачено из начислений периода: <strong>{money(data.paid)}</strong>.
          Снимок процента и базы сохраняется при завершении заказа.
        </p>
        {data.payouts.length ? (
          <div className="admin-table-shell">
            <table className="crm-ledger">
              <thead>
                <tr>
                  <th>Клинер / заказ</th>
                  <th>Цена / база / процент</th>
                  <th>Начислено</th>
                  <th>Статус / paidAt</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {data.payouts.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={"/admin/cleaners/" + p.cleanerId}>
                        {p.cleaner}
                      </Link>
                      <br />
                      <Link href={"/admin/orders/" + p.orderId}>
                        {p.reference}
                      </Link>
                    </td>
                    <td>
                      {money(p.finalPrice)}
                      <br />
                      <small>
                        База {money(p.basisAmount)} · {p.appliedPercent}%
                      </small>
                    </td>
                    <td>{money(p.amount)}</td>
                    <td>
                      {payoutLabels[p.status]}
                      <br />
                      {p.paidAt ? date(p.paidAt) : "—"}
                    </td>
                    <td>
                      {p.status === "PENDING" && (
                        <FinanceForm
                          command="payout-pay"
                          payload={{ id: p.id, expectedUpdatedAt: p.updatedAt }}
                          button="Отметить выплаченным"
                          confirm
                        />
                      )}
                      <details>
                        <summary>Осознанная корректировка</summary>
                        <p className="crm-hint">
                          Это отдельная операция; изменение цены или процента
                          само не меняет начисление.
                        </p>
                        <FinanceForm
                          command="payout-adjust"
                          payload={{ id: p.id, expectedUpdatedAt: p.updatedAt }}
                          confirm
                          button="Изменить сумму"
                        >
                          <Field
                            name="amount"
                            label="Новая сумма, RSD"
                            type="number"
                            min={0}
                            step={0.01}
                            value={p.amount}
                            required
                          />
                          <Field name="reason" label="Причина" required />
                        </FinanceForm>
                        {p.status === "PENDING" && (
                          <FinanceForm
                            command="payout-recalculate"
                            payload={{
                              id: p.id,
                              expectedUpdatedAt: p.updatedAt,
                            }}
                            confirm
                            button="Пересчитать по текущим условиям"
                          >
                            <Field
                              name="reason"
                              label="Причина пересчёта"
                              required
                            />
                          </FinanceForm>
                        )}
                        {p.status !== "CANCELLED" && (
                          <FinanceForm
                            command="payout-cancel"
                            payload={{
                              id: p.id,
                              expectedUpdatedAt: p.updatedAt,
                            }}
                            confirm
                            button="Отменить начисление"
                          >
                            <Field
                              name="reason"
                              label="Причина отмены"
                              required
                            />
                          </FinanceForm>
                        )}
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="crm-hint">
            Начислений пока нет. Задайте проценты в настройках или карточках
            клинеров.
          </p>
        )}
      </section>
      {Math.max(data.expenseCount, data.payoutCount) > 30 && (
        <div className="finance-links">
          {data.page > 1 && (
            <Link
              href={
                "?" +
                new URLSearchParams({
                  ...(Object.fromEntries(
                    Object.entries(input).filter(([, v]) => v !== undefined),
                  ) as Record<string, string>),
                  page: String(data.page - 1),
                })
              }
            >
              ← Предыдущая
            </Link>
          )}
          <span>Страница {data.page}</span>
          {Math.max(data.expenseCount, data.payoutCount) > data.page * 30 && (
            <Link
              href={
                "?" +
                new URLSearchParams({
                  ...(Object.fromEntries(
                    Object.entries(input).filter(([, v]) => v !== undefined),
                  ) as Record<string, string>),
                  page: String(data.page + 1),
                })
              }
            >
              Следующая →
            </Link>
          )}
        </div>
      )}
      <section className="crm-section" id="trends">
        <h2>Выручка по месяцам</h2>
        {data.months.length ? (
          data.months.map((m) => (
            <div className="finance-bar" key={m.month}>
              <span>{m.month}</span>
              <div>
                <i
                  style={{
                    width: `${Math.max(2, (m.revenue / Math.max(...data.months.map((m) => m.revenue), 1)) * 100)}%`,
                  }}
                />
              </div>
              <strong>{money(m.revenue)}</strong>
            </div>
          ))
        ) : (
          <p className="crm-hint">Для графика ещё нет завершённых заказов.</p>
        )}
        <h3>Расходы по категориям</h3>
        <Facts
          items={data.categories.map((c) => [
            expenseLabels[c.category],
            money(c.amount),
          ])}
        />
      </section>
      {data.investments.length > 0 && (
        <section className="crm-section">
          <h2>Личные вложения</h2>
          <p className="crm-hint">
            Финансирование показывается отдельно и не вычитается повторно из
            операционной прибыли.
          </p>
          {data.investments.map((i) => (
            <div key={i.id}>
              <p>
                {i.paidBy} · {i.description}
              </p>
              <Facts
                items={[
                  ["Вложено", money(i.amount)],
                  ["Возвращено", money(i.returnedAmount)],
                  ["Остаток", money(i.amount - i.returnedAmount)],
                ]}
              />
            </div>
          ))}
        </section>
      )}
    </>
  );
}
