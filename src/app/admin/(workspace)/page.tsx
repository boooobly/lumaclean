import Link from "next/link";
import { DisclosureSection } from "@/components/admin/disclosure";
import { getDatabase } from "@/lib/database/client";
import { getCalendarData } from "@/lib/services/scheduling-queries";
import { wallLabel } from "@/lib/domain/scheduling-types";
import { getDashboard } from "@/lib/services/admin-dashboard";
import { Chip, date } from "@/components/admin/crm-view";
import { AIInboxSummary } from "@/components/admin/ai-inbox-summary";

export const metadata = { title: "Главная" };

export default async function DashboardPage() {
  const [data, schedule] = await Promise.all([
    getDashboard(),
    getCalendarData({ mode: "day" }),
  ]);
  const upcoming = await getDatabase().order.findMany({where:{scheduledStart:{gte:new Date()},status:{notIn:["CANCELLED","NO_SHOW","COMPLETED"]}},orderBy:{scheduledStart:"asc"},take:5,select:{id:true,scheduledStart:true,client:{select:{name:true}},service:{select:{name:true}}}});
  const attention = schedule.orders.filter(
    (o) =>
      o.issues.length &&
      !["CANCELLED", "NO_SHOW", "COMPLETED"].includes(o.status),
  );
  const number = (value: number | string) =>
    new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(
      Number(value),
    );
  const today = new Intl.DateTimeFormat("ru-RU", {
    timeZone: data.timezone,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(data.now);
  const month = new Intl.DateTimeFormat("ru-RU", {
    timeZone: data.timezone,
    month: "long",
  }).format(data.now);
  return (
    <div className="admin-dashboard">
      <header className="admin-page-header">
        <div className="admin-eyebrow">01 / Обзор работы</div>
        <div className="admin-heading-row">
          <h1>Всё на своих местах.</h1>
          <p className="admin-date">
            {today}
            <span>Белград · {data.timezone}</span>
          </p>
        </div>
        <p className="admin-intro">
          Рабочая картина LumaClean. Уборки, команда и результаты — в одном
          пространстве.
        </p>
      </header>
      <section aria-label="Текущие показатели" className="admin-metrics">
        {[
          {
            label: "Уборки сегодня",
            value: data.today,
            href: "calendar",
            note: "Подтверждённые и завершённые",
          },
          {
            label: "Новые заявки",
            value: data.leads,
            href: "leads",
            note: "Ожидают первого ответа",
          },
          {
            label: "Клиенты",
            value: data.clients,
            href: "clients",
            note: "В клиентском реестре",
          },
          {
            label: "Активные клинеры",
            value: data.cleaners,
            href: "cleaners",
            note: "В составе команды",
          },
        ].map((metric, index) => (
          <Link
            href={`/admin/${metric.href}`}
            className="admin-metric"
            key={metric.href}
          >
            <div>
              <span>{metric.label}</span>
              <small>{String(index + 1).padStart(2, "0")}</small>
            </div>
            <strong>{number(metric.value)}</strong>
            <p>
              {metric.note}
              <span aria-hidden="true">↗</span>
            </p>
          </Link>
        ))}
      </section>
      <div className="admin-overview-grid">
        <section className="admin-today">
          <div className="admin-section-heading">
            <h2>Ритм дня</h2>
            <Link href="/admin/calendar">
              Календарь <span aria-hidden="true">↗</span>
            </Link>
          </div>
          {schedule.orders.length ? (
            <ul className="crm-linked-list">
              {schedule.orders.slice(0, 10).map((o) => (
                <li key={o.id}>
                  <Link href={"/admin/orders/" + o.id}>
                    {wallLabel(o.start)} · {o.client}
                    <small>
                      {o.service} ·{" "}
                      {o.cleaners.map((c) => c.name).join(", ") ||
                        "Без команды"}{" "}
                      · {o.cleaners.length}/{o.requiredCleaners}
                    </small>
                  </Link>
                  <Chip status={o.status} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="admin-empty">
              <h3>На сегодня уборок нет</h3>
              <p>Создайте заказ или разместите согласованное гибкое окно.</p>
              <Link href="/admin/orders/new">Создать заказ →</Link>
            </div>
          )}
          {schedule.orders.length > 10 && (
            <p className="crm-hint">
              Показаны первые 10 уборок. Полный день — в календаре.
            </p>
          )}
        </section>
        <section className="admin-finance-summary">
          <div className="admin-section-heading">
            <h2>Итоги месяца</h2>
            <span>{month}</span>
          </div>
          <dl className="admin-finance-ledger">
            <div>
              <dt>Выручка</dt>
              <dd>
                {number(data.revenue)} <small>{data.currency}</small>
              </dd>
            </div>
            <div>
              <dt>Расходы</dt>
              <dd>
                {number(data.expenses)} <small>{data.currency}</small>
              </dd>
            </div>
          </dl>
          <p>
            Выручка по завершённым уборкам. Расходы бизнеса по дате операции.
            Начисления клинерам и прибыль — в финансовом реестре.
          </p>
          <Link className="admin-text-link" href="/admin/finances">
            Финансовый реестр <span aria-hidden="true">↗</span>
          </Link>
        </section>
      </div>
      <section className="crm-section admin-dashboard-attention">
        <div className="admin-section-heading">
          <h2>Требует внимания · сегодня</h2>
          <Link href="/admin/calendar?mode=day">Проверить день →</Link>
        </div>
        {attention.length ? (
          <ul className="crm-linked-list">
            {attention.slice(0, 8).map((o) => (
              <li key={o.id}>
                <Link href={"/admin/orders/" + o.id}>
                  {o.reference} · {o.client}
                  <small>{o.issues.map((i) => i.message).join(" · ")}</small>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="crm-hint">
            В расписании на сегодня предупреждений нет. Маршруты можно обновить
            в календаре.
          </p>
        )}
        {attention.length > 8 && (
          <p>
            Ещё {attention.length - 8} заказов требуют проверки в календаре.
          </p>
        )}
      </section>
      <section className="crm-section crm-latest">
        <div className="admin-section-heading">
          <h2>Последние заявки</h2>
          <Link href="/admin/leads">Все заявки →</Link>
        </div>
        {data.latestLeads.length ? (
          <ul className="crm-linked-list">
            {data.latestLeads.map((lead) => (
              <li key={lead.id}>
                <Link href={`/admin/leads/${lead.id}`}>
                  {lead.name}
                  <small>
                    {date(lead.createdAt)} ·{" "}
                    {lead.service?.name ?? "Услуга не указана"}
                  </small>
                </Link>
                <Chip status={lead.status} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="crm-hint">
            Новые обращения появятся здесь после отправки формы на сайте.
          </p>
        )}
      </section>
      <div className="admin-dashboard-inbox"><AIInboxSummary /></div>
      {upcoming.length > 0 && <section className="crm-section admin-dashboard-upcoming"><div className="admin-section-heading"><h2>Ближайшие заказы</h2><Link href="/admin/orders">Все заказы →</Link></div><ul className="crm-linked-list">{upcoming.map(order=><li key={order.id}><Link href={`/admin/orders/${order.id}`}>{date(order.scheduledStart)} · {order.client.name}<small>{order.service?.name ?? "Услуга не указана"}</small></Link></li>)}</ul></section>}
      <DisclosureSection title="Рабочий порядок"><section className="admin-next">
        <span className="admin-eyebrow">Рабочий порядок</span>
        <h2>
          Сначала договориться.
          <br />
          Затем — планировать.
        </h2>
        <p>
          Обращение становится заказом после согласования услуги, адреса и
          времени. Это поможет сохранить календарь точным, а работу команды —
          предсказуемой.
        </p>
        <Link href="/admin/orders">
          Реестр заказов <span aria-hidden="true">↗</span>
        </Link>
      </section>
      </DisclosureSection>
      <div className="admin-footnote">
        LumaClean · Внутреннее пространство
        <span>Показатели из базы данных</span>
      </div>
    </div>
  );
}

