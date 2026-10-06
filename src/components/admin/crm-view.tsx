import Link from "next/link";
import type { ReactNode } from "react";
import { ledgerRows } from "./responsive-ledger";
import { DisclosureSection } from "./disclosure";
import {
  leadLabels,
  orderLabels,
  channelLabels,
  serviceLabels,
} from "@/lib/domain/crm-types";
import { getHistory } from "@/lib/services/crm-queries";
import { scalar, type Query } from "@/lib/domain/crm-filters";
export const date = (value: Date | null | undefined) =>
  value
    ? new Intl.DateTimeFormat("ru-RU", {
        timeZone: "Europe/Belgrade",
        dateStyle: "medium",
        timeStyle: "short",
      }).format(value)
    : "—";
export const money = (value: unknown, currency = "RSD") =>
  value === null || value === undefined
    ? "—"
    : `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(Number(String(value)))} ${currency}`;
export function CrmHeader({
  title,
  subtitle,
  back,
  action,
}: {
  title: string;
  subtitle?: string;
  back?: string;
  action?: { href: string; label: string };
}) {
  return (
    <header className="admin-page-header crm-header">
      {back && (
        <Link className="admin-text-link" href={back}>
          ← К реестру
        </Link>
      )}
      <div className="admin-eyebrow">LumaClean / CRM</div>
      <div className="admin-heading-row">
        <h1>{title}</h1>
        {action && (
          <Link className="crm-button" href={action.href}>
            {action.label} <span aria-hidden="true">＋</span>
          </Link>
        )}
      </div>
      {subtitle && <details className="admin-header-help"><summary>Что это?</summary><p className="admin-intro">{subtitle}</p></details>}
    </header>
  );
}
export function Chip({ status }: { status: string }) {
  const labels: Record<string, string> = { ...leadLabels, ...orderLabels };
  return (
    <span className={`crm-chip crm-chip-${status.toLowerCase()}`}>
      {labels[status] ?? status}
    </span>
  );
}
export function Ledger({
  headers,
  children,
  empty,
  secondary = [],
}: {
  headers: string[];
  children: ReactNode;
  empty?: string;
  secondary?: string[];
}) {
  return empty ? (
    <div className="crm-empty">
      <h2>{empty}</h2>
      <p>Попробуйте изменить фильтры или создайте первую запись.</p>
    </div>
  ) : (
    <div
      className="crm-ledger-scroll"
      tabIndex={0}
      role="region"
      aria-label="Реестр"
    >
      <table className="crm-ledger">
        <thead>
          <tr>
            {headers.map((h) => (
              <th scope="col" key={h}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{ledgerRows(children, headers, secondary)}</tbody>
      </table>
    </div>
  );
}
export function Filters({
  kind,
  query,
}: {
  kind: "leads" | "clients" | "orders";
  query: Query;
}) {
  return (
    <DisclosureSection title="Поиск и фильтры" open={Object.values(query).some(value => Boolean(value))} className="admin-filter-disclosure"><form className="crm-filters" method="GET">
      <label>
        Поиск
        <input
          type="search"
          name="q"
          defaultValue={scalar(query, "q")}
          placeholder="Имя, телефон, номер"
        />
      </label>
      {kind !== "clients" && (
        <label>
          Статус
          <select name="status" defaultValue={scalar(query, "status")}>
            <option value="">Все статусы</option>
            {Object.entries(kind === "leads" ? leadLabels : orderLabels).map(
              ([key, value]) => (
                <option key={key} value={key}>
                  {value}
                </option>
              ),
            )}
          </select>
        </label>
      )}
      {kind !== "orders" && (
        <label>
          Канал
          <select name="channel" defaultValue={scalar(query, "channel")}>
            <option value="">Все каналы</option>
            {Object.entries(channelLabels).map(([key, value]) => (
              <option value={key} key={key}>
                {value}
              </option>
            ))}
          </select>
        </label>
      )}
      {kind !== "clients" && (
        <label>
          Услуга
          <select name="service" defaultValue={scalar(query, "service")}>
            <option value="">Все услуги</option>
            {Object.entries(serviceLabels).map(([key, value]) => (
              <option key={key} value={key}>
                {value}
              </option>
            ))}
          </select>
        </label>
      )}
      {kind === "clients" && (
        <label>
          Заказы
          <select name="orders" defaultValue={scalar(query, "orders")}>
            <option value="">Все клиенты</option>
            <option value="yes">Есть заказы</option>
            <option value="no">Без заказов</option>
          </select>
        </label>
      )}
      {kind === "orders" && (
        <>
          <label>
            Дата уборки от
            <input
              type="date"
              name="from"
              defaultValue={scalar(query, "from")}
            />
          </label>
          <label>
            До включительно
            <input type="date" name="to" defaultValue={scalar(query, "to")} />
          </label>
        </>
      )}
      <label>
        Сортировка
        <select name="sort" defaultValue={scalar(query, "sort")}>
          <option value="">Сначала новые</option>
          <option value="oldest">Сначала старые</option>
          {kind === "clients" && <option value="name">По имени</option>}
          {kind === "orders" && (
            <option value="scheduled">По времени уборки</option>
          )}
        </select>
      </label>
      {scalar(query, "clientId") && (
        <input
          type="hidden"
          name="clientId"
          value={scalar(query, "clientId")}
        />
      )}
      <div className="crm-filter-actions">
        <button type="submit" className="crm-button">
          Найти
        </button>
        <Link className="admin-text-link" href={`/admin/${kind}`}>
          Сбросить
        </Link>
      </div>
    </form></DisclosureSection>
  );
}
export function Pager({
  count,
  page,
  size,
  query,
  path,
}: {
  count: number;
  page: number;
  size: number;
  query: Query;
  path: string;
}) {
  const pages = Math.max(1, Math.ceil(count / size));
  const url = (p: number) => {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => {
      if (typeof v === "string" && k !== "page") params.set(k, v);
    });
    params.set("page", String(p));
    return `${path}?${params}`;
  };
  return (
    <nav className="crm-pager" aria-label="Страницы реестра">
      <span>
        {count} записей · страница {page} из {pages}
      </span>
      <div>
        {page > 1 && <Link href={url(page - 1)}>← Предыдущая</Link>}
        {page < pages && <Link href={url(page + 1)}>Следующая →</Link>}
      </div>
    </nav>
  );
}
export function Facts({ items, secondary = [], technical = [] }: { items: [string, ReactNode][]; secondary?: string[]; technical?: string[] }) {
  const list = (rows: [string, ReactNode][]) => <dl className="crm-facts">{rows.map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value ?? "—"}</dd></div>)}</dl>;
  if (secondary.length || technical.length) return <>{list(items.filter(([label])=> !secondary.includes(label) && !technical.includes(label)))}{items.some(([label])=>secondary.includes(label)) && <DisclosureSection title="Подробнее">{list(items.filter(([label])=>secondary.includes(label)))}</DisclosureSection>}{items.some(([label])=>technical.includes(label)) && <DisclosureSection title="Технические детали">{list(items.filter(([label])=>technical.includes(label)))}</DisclosureSection>}</>;
  return (
    <dl className="crm-facts">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
const actionLabels: Record<string, string> = {
  CLEANER_CREATED: "Клинер создан",
  CLEANER_UPDATED: "Клинер изменён",
  CLEANER_ACTIVITY_CHANGED: "Активность клинера изменена",
  AVAILABILITY_WEEK_UPDATED: "Недельный график изменён",
  AVAILABILITY_EXCEPTION_UPDATED: "Исключение по дате сохранено",
  AVAILABILITY_EXCEPTION_REMOVED: "Исключение убрано",
  CLEANER_ASSIGNED: "Клинер назначен",
  CLEANER_UNASSIGNED: "Назначение снято",
  ORDER_DURATION_CHANGED: "Плановая длительность изменена",
  ORDER_DRAGGED: "Заказ перенесён в календаре",
  ORDER_UNPLACED: "Гибкий заказ снят с календаря",
  SCHEDULING_OVERRIDE: "Предупреждения явно подтверждены",
  LEAD_CREATED: "Заявка создана",
  LEAD_STATUS_CHANGED: "Статус заявки изменён",
  LEAD_NOTE_CHANGED: "Внутренняя заметка изменена",
  LEAD_LINKED: "Заявка связана с клиентом",
  LEAD_CONVERTED: "Из заявки создан заказ",
  CLIENT_CREATED: "Клиент создан",
  CLIENT_UPDATED: "Клиент изменён",
  ADDRESS_CREATED: "Адрес добавлен",
  ADDRESS_UPDATED: "Адрес изменён",
  ADDRESS_ACTIVE_CHANGED: "Доступность адреса изменена",
  ORDER_CREATED: "Заказ создан",
  CLIENT_ORDER_CREATED: "Создан заказ клиента",
  ORDER_UPDATED: "Заказ изменён",
  ORDER_RESCHEDULED: "Время уборки перенесено",
  ORDER_PRICE_CHANGED: "Цена изменена",
  ORDER_STATUS_CHANGED: "Статус заказа изменён",
  ORDER_CANCELLED: "Заказ отменён",
  ORDER_COMPLETED: "Заказ завершён",
};
export async function History({ type, id }: { type: string; id: string }) {
  const rows = await getHistory(type, id);
  return (
    <DisclosureSection title="История" className="crm-history-disclosure">
      {!rows.length ? (
        <p className="crm-hint">Изменений пока нет.</p>
      ) : (
        <ol className="crm-history">
          {rows.map((row) => {
            const diff = row.changes as {
              status?: { before: string; after: string };
              finalPrice?: { before: string | null; after: string | null };
              scheduledStart?: { before: string | null; after: string | null };
              windowFrom?: { before: string | null; after: string | null };
              windowTo?: { before: string | null; after: string | null };
              active?: { before: boolean; after: boolean };
            } | null;
            const statuses: Record<string, string> = {
              ...leadLabels,
              ...orderLabels,
            };
            return (
              <li key={row.id}>
                <time dateTime={row.createdAt.toISOString()}>
                  {date(row.createdAt)}
                </time>
                <div>
                  <strong>
                    {row.user?.name ??
                      (row.actorType === "SYSTEM" ? "Система" : "AI")}
                  </strong>{" "}
                  · {actionLabels[row.action] ?? "Запись обновлена"}
                  {diff?.status && (
                    <p>
                      {statuses[diff.status.before] ?? diff.status.before} →{" "}
                      {statuses[diff.status.after] ?? diff.status.after}
                    </p>
                  )}
                  {diff?.finalPrice && (
                    <p>
                      {money(diff.finalPrice.before)} →{" "}
                      {money(diff.finalPrice.after)}
                    </p>
                  )}
                  {diff?.active && (
                    <p>{diff.active.after ? "Активирован" : "Деактивирован"}</p>
                  )}
                  {["scheduledStart", "windowFrom", "windowTo"].map((key) => {
                    const change = diff?.[key as "scheduledStart"];
                    return change ? (
                      <p key={key}>
                        {key === "scheduledStart"
                          ? "Начало"
                          : key === "windowFrom"
                            ? "Окно от"
                            : "Окно до"}
                        : {date(change.before ? new Date(change.before) : null)}{" "}
                        → {date(change.after ? new Date(change.after) : null)}
                      </p>
                    ) : null;
                  })}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {rows.length === 50 && (
        <p className="crm-hint">
          Показаны последние 50 событий. Полный аудит сохранён в БД.
        </p>
      )}
    </DisclosureSection>
  );
}
