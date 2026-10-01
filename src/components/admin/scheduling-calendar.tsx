"use client";
import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type CSSProperties,
} from "react";
import { Temporal } from "@js-temporal/polyfill";
import {
  businessDate,
  businessMinute,
  dayLabel,
  minuteLabel,
  wallLabel,
  closedStatuses,
  type CalendarData,
  type CalendarOrder,
} from "@/lib/domain/scheduling-types";
import { orderLabels } from "@/lib/domain/crm-types";
import { PlanEditor, type PlanDraft } from "./order-planning";
import { scheduleMutation } from "./scheduling-forms";
const PIXELS_PER_MINUTE = 1.2;
const today = () => Temporal.Now.plainDateISO("Europe/Belgrade").toString();
function belongs(order: CalendarOrder, day: string) {
  return Boolean(
    order.start &&
      businessDate(order.start) <= day &&
      businessDate(
        order.end
          ? new Date(new Date(order.end).getTime() - 1).toISOString()
          : order.start,
      ) >= day,
  );
}
function newOrder(day: string, minute = 540) {
  return (
    "/admin/orders/new?scheduledStart=" +
    encodeURIComponent(day + "T" + minuteLabel(minute))
  );
}
function EventCard({
  order,
  onOpen,
  onDrag,
  style,
}: {
  order: CalendarOrder;
  onOpen: () => void;
  onDrag: (e: DragEvent<HTMLButtonElement>) => void;
  style?: CSSProperties;
}) {
  return (
    <button
      type="button"
      className={"calendar-event calendar-status-" + order.status.toLowerCase()}
      style={style}
      draggable={!closedStatuses.includes(order.status)}
      onDragStart={onDrag}
      onClick={onOpen}
      data-order-id={order.id}
      title={[
        wallLabel(order.start),
        order.client,
        order.service,
        order.address,
        order.duration === null
          ? "Длительность не задана"
          : order.duration + " мин",
        order.cleaners.map((c) => c.name).join(", "),
        orderLabels[order.status],
      ].join(" · ")}
      aria-label={
        order.reference +
        " · " +
        order.client +
        " · " +
        wallLabel(order.start) +
        " · " +
        orderLabels[order.status]
      }
    >
      <time>
        {order.start ? minuteLabel(businessMinute(order.start)) : "Гибкое окно"}
        {order.end && "–" + minuteLabel(businessMinute(order.end))}
      </time>
      <strong>{order.client}</strong>
      <span>
        {order.service} ·{" "}
        {order.duration === null
          ? "Длительность не задана"
          : order.duration + " мин"}
      </span>
      <span>{order.address}</span>
      <span>
        {order.cleaners.map((c) => c.name).join(", ") || "Команда не назначена"}{" "}
        · {order.cleaners.length}/{order.requiredCleaners}
      </span>
      <small>
        {orderLabels[order.status]}
        {order.issues.length > 0 &&
          " · " +
            (order.issues.some((i) => i.severity === "ERROR")
              ? "Конфликт"
              : "Внимание")}
      </small>
    </button>
  );
}
export function SchedulingCalendar({ initial }: { initial: CalendarData }) {
  const [data, setData] = useState(initial),
    [resource, setResource] = useState(false),
    [selected, setSelected] = useState(initial.date);
  const [editing, setEditing] = useState<{
      order: CalendarOrder;
      draft?: PlanDraft;
    } | null>(null),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const dragging = useRef<string | null>(null),
    scroller = useRef<HTMLDivElement>(null),
    busy = useRef(false);
  const placed = data.orders.filter((o) => o.start),
    unplaced = data.orders.filter(
      (o) => !o.start && !closedStatuses.includes(o.status),
    ),
    closedWindows = data.orders.filter(
      (o) => !o.start && closedStatuses.includes(o.status),
    );
  useEffect(() => {
    if (scroller.current)
      scroller.current.scrollTop = 7 * 60 * PIXELS_PER_MINUTE;
  }, [data.mode, resource]);
  const url = (date: string, mode = data.mode, cleanerId = data.cleanerId) =>
    "/admin/calendar?" +
    new URLSearchParams({ date, mode, ...(cleanerId ? { cleanerId } : {}) });
  const anchor = Temporal.PlainDate.from(data.date),
    step =
      data.mode === "month"
        ? { months: 1 }
        : { days: data.mode === "week" ? 7 : 1 };
  async function reload() {
    const response = await fetch(
      "/api/admin/calendar?" +
        new URLSearchParams({
          date: data.date,
          mode: data.mode,
          ...(data.cleanerId ? { cleanerId: data.cleanerId } : {}),
        }),
      { cache: "no-store" },
    );
    if (!response.ok) throw new Error("Calendar refresh failed");
    const result = await response.json();
    setData(result.data);
  }
  function drag(order: CalendarOrder, e: DragEvent<HTMLButtonElement>) {
    dragging.current = order.id;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", order.id);
  }
  async function drop(e: DragEvent<HTMLElement>, day: string, minute?: number) {
    e.preventDefault();
    const id = dragging.current;
    dragging.current = null;
    const order = data.orders.find((o) => o.id === id);
    if (!order || closedStatuses.includes(order.status) || busy.current) return;
    const start =
      day +
      "T" +
      minuteLabel(
        minute ??
          (order.start
            ? businessMinute(order.start)
            : order.windowFrom
              ? businessMinute(order.windowFrom)
              : 540),
      );
    if (start === order.localStart) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const result = await scheduleMutation("order-plan", {
        id: order.id,
        expectedUpdatedAt: order.updatedAt,
        scheduledStart: start,
        manualDurationMinutes: order.manualDuration,
        cleanerIds: order.cleaners.map((c) => c.id),
        source: "CALENDAR_DRAG",
      });
      if (result.ok) await reload();
      else {
        setEditing({
          order,
          draft: {
            start,
            source: "CALENDAR_DRAG",
            issues: result.issues ?? [],
          },
        });
        setError(result.error ?? "Перенос не сохранён");
      }
    } catch {
      setError(
        "Не удалось обновить календарь. Обновите страницу, чтобы проверить сохранённое время.",
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  const card = (order: CalendarOrder, style?: CSSProperties) => (
    <EventCard
      key={order.id}
      order={order}
      style={style}
      onDrag={(e) => drag(order, e)}
      onOpen={() => setEditing({ order })}
    />
  );
  const dayOrders = (day: string) => placed.filter((o) => belongs(o, day));
  function timeEvents(day: string) {
    const intervals = dayOrders(day)
      .map((order) => ({
        order,
        start:
          businessDate(order.start!) < day ? 0 : businessMinute(order.start!),
        end: !order.end
          ? null
          : businessDate(order.end) > day
            ? 1440
            : businessMinute(order.end),
      }))
      .sort(
        (a, b) => a.start - b.start || a.order.id.localeCompare(b.order.id),
      );
    const lanes: number[] = [];
    const assigned = intervals.map((row) => {
      let lane = lanes.findIndex((end) => end <= row.start);
      if (lane < 0) lane = lanes.length;
      const height = Math.max(
        68,
        ((row.end ?? row.start + 30) - row.start) * PIXELS_PER_MINUTE,
      );
      lanes[lane] = row.start + height / PIXELS_PER_MINUTE;
      return { ...row, lane, height };
    });
    const width = 100 / Math.max(1, lanes.length);
    return assigned.map((row) =>
      card(row.order, {
        top: row.start * PIXELS_PER_MINUTE,
        height: row.height,
        left: `calc(${row.lane * width}% + 3px)`,
        width: `calc(${width}% - 6px)`,
      }),
    );
  }
  return (
    <div className="scheduling-calendar" aria-busy={pending}>
      <div className="calendar-toolbar">
        <nav aria-label="Период календаря">
          <Link
            prefetch={false}
            href={url(anchor.subtract(step).toString())}
            aria-label="Предыдущий период"
          >
            ←
          </Link>
          <Link prefetch={false} href={url(today())}>
            Сегодня
          </Link>
          <Link
            prefetch={false}
            href={url(anchor.add(step).toString())}
            aria-label="Следующий период"
          >
            →
          </Link>
        </nav>
        <strong>
          {data.mode === "month"
            ? new Intl.DateTimeFormat("ru-RU", {
                timeZone: "UTC",
                month: "long",
                year: "numeric",
              }).format(new Date(data.date + "T12:00:00Z"))
            : data.mode === "day"
              ? dayLabel(data.date, true)
              : dayLabel(data.from) + " — " + dayLabel(data.to)}
        </strong>
        <nav aria-label="Вид календаря">
          {(
            [
              ["day", "День"],
              ["week", "Неделя"],
              ["month", "Месяц"],
            ] as const
          ).map(([mode, label]) => (
            <Link
              key={mode}
              prefetch={false}
              href={url(data.date, mode)}
              aria-current={data.mode === mode ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
      <form className="calendar-filters" action="/admin/calendar">
        <input type="hidden" name="mode" value={data.mode} />
        <label>
          Дата
          <input name="date" type="date" defaultValue={data.date} />
        </label>
        <label>
          Клинер
          <select name="cleanerId" defaultValue={data.cleanerId}>
            <option value="">Вся команда</option>
            {data.cleaners.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {!c.active && " · неактивен"}
              </option>
            ))}
          </select>
        </label>
        <button className="crm-button">Показать</button>
        <button
          type="button"
          aria-pressed={resource}
          onClick={() => setResource((v) => !v)}
        >
          {resource ? "По времени" : "По клинерам"}
        </button>
      </form>
      <p className="schedule-travel">
        Europe/Belgrade · дорога не проверена · операционный буфер по умолчанию{" "}
        {data.travelBuffer} мин. Время можно изменить в панели заказа.
      </p>
      {pending && <p role="status">Проверяем и сохраняем перенос…</p>}
      {error && (
        <p role="alert" className="crm-form-error">
          {error}
        </p>
      )}
      {data.truncated && (
        <p role="alert">
          Достигнут предел записей. Выберите меньший период; список клинеров
          доступен в реестре.
        </p>
      )}
      {resource ? (
        <div className="calendar-resource-scroll">
          <table className="calendar-resource">
            <caption>
              Заказы по клинерам · несколько клинеров видят один и тот же заказ
            </caption>
            <thead>
              <tr>
                <th>Клинер</th>
                {data.days.map((day) => (
                  <th key={day}>{dayLabel(day, true)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { id: "", name: "Без команды" },
                ...data.cleaners.filter(
                  (c) => !data.cleanerId || c.id === data.cleanerId,
                ),
              ].map((c) => (
                <tr key={c.id}>
                  <th scope="row">{c.name}</th>
                  {data.days.map((day) => (
                    <td key={day}>
                      {data.orders
                        .filter(
                          (o) =>
                            (o.start
                              ? belongs(o, day)
                              : o.windowFrom &&
                                o.windowTo &&
                                businessDate(o.windowFrom) <= day &&
                                businessDate(o.windowTo) >= day) &&
                            (c.id
                              ? o.cleaners.some((a) => a.id === c.id)
                              : !o.cleaners.length),
                        )
                        .map((o) => card(o))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : data.mode === "month" ? (
        <div className="calendar-month">
          {data.days.map((day) => (
            <section
              key={day}
              className={
                "calendar-month-day" +
                (day.slice(0, 7) !== data.date.slice(0, 7)
                  ? " calendar-outside"
                  : "")
              }
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => void drop(e, day)}
            >
              <div>
                <strong>{dayLabel(day, true)}</strong>
                <Link
                  href={newOrder(day)}
                  aria-label={"Создать заказ " + dayLabel(day)}
                >
                  ＋
                </Link>
              </div>
              {dayOrders(day).map((o) => card(o))}
            </section>
          ))}
        </div>
      ) : (
        <>
          <div className="calendar-time-scroll" ref={scroller}>
            <div
              className="calendar-time-grid"
              style={{
                gridTemplateColumns: `48px repeat(${data.days.length}, minmax(${data.mode === "day" ? "240" : "190"}px, 1fr))`,
              }}
            >
              <div className="calendar-time-heading">Время</div>
              {data.days.map((day) => (
                <div className="calendar-time-heading" key={day}>
                  {dayLabel(day, true)}
                </div>
              ))}
              <div className="calendar-hours">
                {Array.from({ length: 24 }, (_, h) => (
                  <span key={h} style={{ top: h * 60 * PIXELS_PER_MINUTE }}>
                    {minuteLabel(h * 60)}
                  </span>
                ))}
              </div>
              {data.days.map((day) => (
                <div
                  className="calendar-time-day"
                  key={day}
                  data-day={day}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    const minute = Math.max(
                      0,
                      Math.min(
                        1425,
                        Math.round(
                          (e.clientY -
                            e.currentTarget.getBoundingClientRect().top) /
                            PIXELS_PER_MINUTE /
                            15,
                        ) * 15,
                      ),
                    );
                    void drop(e, day, minute);
                  }}
                >
                  {Array.from({ length: 48 }, (_, i) => (
                    <Link
                      key={i}
                      className="calendar-slot"
                      href={newOrder(day, i * 30)}
                      style={{ top: i * 30 * PIXELS_PER_MINUTE }}
                      aria-label={
                        "Создать заказ " + day + " " + minuteLabel(i * 30)
                      }
                    >
                      ＋
                    </Link>
                  ))}
                  {timeEvents(day)}
                </div>
              ))}
            </div>
          </div>
          <div className="calendar-agenda">
            <div className="calendar-agenda-days" aria-label="День списка">
              {data.days.map((day) => (
                <button
                  key={day}
                  type="button"
                  aria-pressed={day === selected}
                  onClick={() => setSelected(day)}
                >
                  {dayLabel(day, true)}
                </button>
              ))}
            </div>
            <h2>{dayLabel(selected, true)}</h2>
            {dayOrders(selected).length ? (
              dayOrders(selected).map((o) => card(o))
            ) : (
              <p className="crm-hint">Размещённых уборок нет.</p>
            )}
            <Link className="crm-button" href={newOrder(selected)}>
              Создать заказ на этот день
            </Link>
          </div>
        </>
      )}
      <section className="calendar-pending">
        <div className="admin-section-heading">
          <h2>Ожидают размещения · {unplaced.length}</h2>
          <Link href="/admin/orders/new">Создать заказ →</Link>
        </div>
        <p className="crm-hint">
          Гибкие окна выбранного периода. Перетащите заказ или задайте время в
          панели; вся уборка должна попасть в обещанное окно.
        </p>
        {unplaced.length ? (
          <div className="calendar-pending-list">
            {unplaced.map((o) => (
              <div key={o.id}>
                {card(o)}
                <small>
                  {wallLabel(o.windowFrom)} — {wallLabel(o.windowTo)}
                </small>
              </div>
            ))}
          </div>
        ) : (
          <p className="crm-hint">Неразмещённых гибких заказов нет.</p>
        )}
      </section>
      {closedWindows.length > 0 && (
        <details className="calendar-pending">
          <summary>Закрытые гибкие окна · {closedWindows.length}</summary>
          <div className="calendar-pending-list">
            {closedWindows.map((o) => card(o))}
          </div>
        </details>
      )}
      {editing &&
        (closedStatuses.includes(editing.order.status) ? (
          <div className="calendar-readonly" role="status">
            {editing.order.reference} · {orderLabels[editing.order.status]} ·{" "}
            <Link href={"/admin/orders/" + editing.order.id}>
              Открыть карточку →
            </Link>
            <button type="button" onClick={() => setEditing(null)}>
              Закрыть
            </button>
          </div>
        ) : (
          <PlanEditor
            key={editing.order.id + editing.order.updatedAt}
            order={editing.order}
            cleaners={data.cleaners}
            draft={editing.draft}
            onClose={() => setEditing(null)}
            onSaved={reload}
          />
        ))}
    </div>
  );
}
