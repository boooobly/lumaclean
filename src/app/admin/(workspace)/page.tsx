import Link from "next/link";
import { getDashboard } from "@/lib/services/admin-dashboard";
import {Chip,date} from "@/components/admin/crm-view";

export const metadata = { title: "Главная" };

export default async function DashboardPage() {
  const data = await getDashboard();
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
    <>
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
          <div className="admin-empty">
            <span className="admin-empty-mark" aria-hidden="true">
              └
            </span>
            <h3>
              {data.today === 0
                ? "На сегодня уборок нет"
                : `Уборок сегодня: ${number(data.today)}`}
            </h3>
            <p>
              {data.today === 0
                ? "Когда появятся подтверждённые заказы, здесь будет видна загрузка дня. Заявки ждут согласования в своём разделе."
                : "Количество учитывает подтверждённые, текущие и завершённые уборки. Подробное расписание появится на этапе календаря."}
            </p>
            <Link className="admin-text-link" href="/admin/leads">
              Перейти к заявкам <span aria-hidden="true">↗</span>
            </Link>
          </div>
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
            Выручка по завершённым уборкам. Расходы по дате операции, включая
            оформленные выплаты команде.
          </p>
          <Link className="admin-text-link" href="/admin/finances">
            Финансовый реестр <span aria-hidden="true">↗</span>
          </Link>
        </section>
      </div>
      <section className="crm-section crm-latest">
        <div className="admin-section-heading"><h2>Последние заявки</h2><Link href="/admin/leads">Все заявки →</Link></div>
        {data.latestLeads.length ? <ul className="crm-linked-list">{data.latestLeads.map(lead=><li key={lead.id}><Link href={`/admin/leads/${lead.id}`}>{lead.name}<small>{date(lead.createdAt)} · {lead.service?.name ?? "Услуга не указана"}</small></Link><Chip status={lead.status}/></li>)}</ul> : <p className="crm-hint">Новые обращения появятся здесь после отправки формы на сайте.</p>}
      </section>
      <section className="admin-next">
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
      <div className="admin-footnote">
        LumaClean · Внутреннее пространство
        <span>Показатели из базы данных</span>
      </div>
    </>
  );
}
