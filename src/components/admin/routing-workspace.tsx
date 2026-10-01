"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Temporal } from "@js-temporal/polyfill";
import {
  wallLabel,
  type CalendarOrder,
  type CrewOption,
} from "@/lib/domain/scheduling-types";
import { routeLabels, type RouteDetails } from "@/lib/domain/routing";
import type { TravelLeg, Slot } from "@/lib/domain/logistics";
import { PlanEditor } from "./order-planning";
import { DayMap } from "./routing-map";
export async function routingRequest<T>(
  command: string,
  payload: unknown,
): Promise<T> {
  const response = await fetch("/api/admin/routing/" + command, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
    body = await response.json();
  if (!response.ok || !body.ok)
    throw new Error(body.error ?? "Расчёт недоступен");
  return body.data as T;
}
type DayData = {
  date: string;
  available: boolean;
  legs: TravelLeg[];
  points: {
    id: string;
    label: string;
    point: { latitude: number; longitude: number };
    kind: string;
  }[];
};
type Proposal = {
  proposalId: string | null;
  changes: {
    id: string;
    reference: string;
    start: string | null;
    previousStart: string | null;
    cleanerIds: string[];
    cleaners: string[];
  }[];
  unplaced: string[];
  travelMinutes: number;
  loads: { id: string; name: string; minutes: number }[];
  bounded: boolean;
  feasible: boolean;
  message: string;
  explanations: string[];
};
export function RoutingWorkspace({
  date: initialDate,
  cleanerId,
  order,
  cleaners = [],
}: {
  date: string;
  cleanerId?: string;
  order?: CalendarOrder;
  cleaners?: CrewOption[];
}) {
  const router = useRouter(),
    [date, setDate] = useState(initialDate),
    [day, setDay] = useState<DayData | null>(null),
    [proposal, setProposal] = useState<Proposal | null>(null),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [details, setDetails] = useState<
      | (RouteDetails & { notice: string; origin: string; destination: string })
      | null
    >(null),
    [map, setMap] = useState(false),
    [editing, setEditing] = useState<Slot | null>(null),
    busy = useRef(false);
  async function run(action: () => Promise<void>) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Расчёт недоступен");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  const legs =
    day?.legs.filter(
      (l) => !order || l.orderId === order.id || l.previousId === order.id,
    ) ?? [];
  return (
    <section className="crm-section routing-workspace" aria-busy={pending}>
      <div className="admin-section-heading">
        <h2>Логистика{order ? " заказа" : " дня"}</h2>
        <span>Google · общественный транспорт</span>
      </div>
      <div className="routing-actions">
        <label>
          День
          <input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setDay(null);
              setProposal(null);
              setDetails(null);
            }}
          />
        </label>
        <button
          className="crm-button crm-button-secondary"
          disabled={pending}
          onClick={() =>
            void run(async () =>
              setDay(
                await routingRequest<DayData>("day", {
                  date,
                  ...(cleanerId ? { cleanerId } : {}),
                }),
              ),
            )
          }
        >
          Проверить маршруты
        </button>
        {!order && (
          <button
            className="crm-button"
            disabled={pending}
            onClick={() =>
              void run(async () =>
                setProposal(
                  await routingRequest<Proposal>("optimize", { date }),
                ),
              )
            }
          >
            Оптимизировать день
          </button>
        )}
        <button
          className="crm-button crm-button-secondary"
          disabled={pending}
          onClick={() =>
            void run(async () => {
              if (!day)
                setDay(
                  await routingRequest<DayData>("day", {
                    date,
                    ...(cleanerId ? { cleanerId } : {}),
                  }),
                );
              setMap((v) => !v);
            })
          }
        >
          Карта
        </button>
      </div>
      <p className="crm-hint">
        Между уборками: окончание и резерв уборки + дорога + операционный запас.
        Первая поездка от дома — без дополнительного запаса. Подробные маршруты
        и такси рассчитываются по запросу.
      </p>
      {error && (
        <p className="crm-form-error" role="alert">
          {error}
        </p>
      )}
      {day && !day.available && (
        <p role="status">
          Google Routes не настроен. Новые поездки требуют ручной проверки;
          ручное планирование доступно.
        </p>
      )}
      {day && legs.length === 0 && (
        <p>Для выбранного дня нет размещённых назначений.</p>
      )}
      {legs.length > 0 && (
        <ul className="routing-legs">
          {legs.map((l) => (
            <li key={l.cleanerId + ":" + l.orderId}>
              <strong>
                {l.cleaner} ·{" "}
                {l.conflict ? "Не успевает" : routeLabels[l.route.status]}
              </strong>
              <p>
                {l.origin} → {l.destination}
              </p>
              {l.route.status === "VERIFIED" &&
                l.route.durationSeconds !== null && (
                  <p>
                    Дорога {Math.ceil(l.route.durationSeconds / 60)} мин · запас{" "}
                    {l.bufferMinutes} мин · прибытие ~
                    {wallLabel(l.earliestArrival)}
                    {!l.previousId &&
                      " · рекомендуемый выход не позднее " +
                        wallLabel(l.recommendedDeparture)}
                  </p>
                )}
              <small>Расчёт: {wallLabel(l.route.calculatedAt)} · Google</small>
              <div className="routing-actions">
                <button
                  className="crm-button crm-button-secondary"
                  disabled={pending}
                  onClick={() =>
                    void run(async () =>
                      setDetails(
                        await routingRequest("details", {
                          date,
                          orderId: l.orderId,
                          cleanerId: l.cleanerId,
                        }),
                      ),
                    )
                  }
                >
                  Подробный маршрут
                </button>
                {(l.conflict || l.route.status !== "VERIFIED") && (
                  <button
                    className="crm-button crm-button-secondary"
                    disabled={pending}
                    onClick={() =>
                      void run(async () =>
                        setDetails(
                          await routingRequest("details", {
                            date,
                            orderId: l.orderId,
                            cleanerId: l.cleanerId,
                            taxi: true,
                          }),
                        ),
                      )
                    }
                  >
                    Проверить такси
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {details && (
        <div className="routing-details" role="status">
          <h3>
            {details.origin} → {details.destination}
          </h3>
          <p>{details.notice}</p>
          <p>
            {routeLabels[details.result.status]}
            {details.result.durationSeconds !== null &&
              " · " + Math.ceil(details.result.durationSeconds / 60) + " мин"}
          </p>
          <ol>
            {details.steps.map((s, i) => (
              <li key={i}>
                {s.mode === "TRANSIT"
                  ? "Транспорт " + (s.line ?? "")
                  : s.mode === "DRIVE"
                    ? "На автомобиле"
                    : "Пешком"}{" "}
                · {Math.ceil(s.durationSeconds / 60)} мин
                {(s.from || s.to) && " · " + s.from + " → " + s.to}
                {s.departure && " · " + wallLabel(s.departure)}
                {s.arrival && " → " + wallLabel(s.arrival)}
                {s.instructions && <p>{s.instructions}</p>}
              </li>
            ))}
          </ol>
          {details.steps.filter((s) => s.mode === "TRANSIT").length > 1 && (
            <p>
              Пересадок:{" "}
              {details.steps.filter((s) => s.mode === "TRANSIT").length - 1}
            </p>
          )}
        </div>
      )}
      {map && day && (
        <DayMap points={day.points} polyline={details?.polyline} />
      )}{" "}
      {proposal && (
        <div className="routing-proposal">
          <h3>Рекомендуемый план</h3>
          <p role="status">{proposal.message}</p>
          <p>
            Дорога: {proposal.travelMinutes} мин · изменений:{" "}
            {proposal.changes.length} · неразмещённых:{" "}
            {proposal.unplaced.length}
          </p>
          <ul>
            {proposal.changes.map((c) => (
              <li key={c.id}>
                <a className="admin-text-link" href={"/admin/orders/" + c.id}>
                  {c.reference}
                </a>{" "}
                · {wallLabel(c.previousStart)} → {wallLabel(c.start)} ·{" "}
                {c.cleaners.join(" + ")}
              </li>
            ))}
          </ul>
          <details>
            <summary>Загрузка и объяснение</summary>
            <ul>
              {proposal.loads.map((c) => (
                <li key={c.id}>
                  {c.name}: {c.minutes} мин уборок
                </li>
              ))}
            </ul>
            {proposal.explanations.map((text, i) => (
              <p key={i}>{text}</p>
            ))}
            {proposal.unplaced.length > 0 && (
              <p>Без подходящего варианта: {proposal.unplaced.join(", ")}</p>
            )}
          </details>
          <div className="routing-actions">
            <button
              className="crm-button"
              disabled={pending || !proposal.proposalId || !proposal.feasible}
              onClick={() =>
                void run(async () => {
                  await routingRequest("apply", {
                    proposalId: proposal.proposalId,
                  });
                  setProposal(null);
                  setDay(null);
                  router.refresh();
                })
              }
            >
              Применить
            </button>
            <button
              className="crm-button crm-button-secondary"
              disabled={pending}
              onClick={() => setProposal(null)}
            >
              Отмена
            </button>
          </div>
        </div>
      )}
      {order && <SlotSearch order={order} onPick={setEditing} />}{" "}
      {editing && order && (
        <PlanEditor
          order={order}
          cleaners={cleaners}
          draft={{
            start: Temporal.Instant.from(editing.start)
              .toZonedDateTimeISO("Europe/Belgrade")
              .toPlainDateTime()
              .toString()
              .slice(0, 16),
            cleanerIds: editing.cleanerIds,
            duration: editing.duration,
            requiredCleaners: editing.cleanerIds.length,
          }}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setDay(null);
            router.refresh();
          }}
        />
      )}
    </section>
  );
}
export function SlotSearch({
  order,
  onPick,
  formRef,
}: {
  order?: CalendarOrder;
  onPick?: (slot: Slot) => void;
  formRef?: React.RefObject<HTMLFormElement | null>;
}) {
  const base =
      order?.localStart.slice(0, 10) ||
      Temporal.Now.plainDateISO("Europe/Belgrade").toString(),
    [date, setDate] = useState(base),
    [from, setFrom] = useState(
      order?.windowFrom
        ? Temporal.Instant.from(order.windowFrom)
            .toZonedDateTimeISO("Europe/Belgrade")
            .toPlainDateTime()
            .toString()
            .slice(0, 16)
        : base + "T09:00",
    ),
    [to, setTo] = useState(
      order?.windowTo
        ? Temporal.Instant.from(order.windowTo)
            .toZonedDateTimeISO("Europe/Belgrade")
            .toPlainDateTime()
            .toString()
            .slice(0, 16)
        : base + "T20:00",
    ),
    [duration, setDuration] = useState(order?.duration ?? 150),
    [required, setRequired] = useState(order?.requiredCleaners ?? 1),
    [result, setResult] = useState<{ slots: Slot[]; message: string } | null>(
      null,
    ),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  async function search(button: HTMLButtonElement) {
    setPending(true);
    setError("");
    const form = formRef?.current ?? button.closest("form");
    try {
      const fields = form ? new FormData(form) : null;
      setResult(
        await routingRequest("slots", {
          date,
          from,
          to,
          duration,
          requiredCleaners: required,
          ...(order
            ? { orderId: order.id }
            : fields?.get("addressId")
              ? { addressId: String(fields.get("addressId")) }
              : fields?.get("locationProof")
                ? { locationProof: String(fields.get("locationProof")) }
                : {}),
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Поиск недоступен");
    } finally {
      setPending(false);
    }
  }
  return (
    <details className="routing-slot-search">
      <summary>Найти свободное время</summary>
      <div className="routing-fields">
        <label>
          Дата
          <input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setFrom(e.target.value + "T09:00");
              setTo(e.target.value + "T20:00");
              setResult(null);
            }}
          />
        </label>
        <label>
          Начало окна
          <input
            type="datetime-local"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setResult(null);
            }}
          />
        </label>
        <label>
          Конец окна
          <input
            type="datetime-local"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setResult(null);
            }}
          />
        </label>
        <label>
          Длительность, мин
          <input
            type="number"
            min="1"
            max="1440"
            value={duration}
            onChange={(e) => {
              setDuration(Number(e.target.value));
              setResult(null);
            }}
          />
        </label>
        <label>
          Нужно клинеров
          <input
            type="number"
            min="1"
            max="20"
            value={required}
            onChange={(e) => {
              setRequired(Number(e.target.value));
              setResult(null);
            }}
          />
        </label>
      </div>
      <button
        type="button"
        className="crm-button crm-button-secondary"
        disabled={pending}
        onClick={(e) => void search(e.currentTarget)}
      >
        {pending ? "Ищем…" : "Найти варианты"}
      </button>
      {error && <p role="alert">{error}</p>}
      {result && (
        <>
          <p role="status">{result.message}</p>
          <ul className="routing-legs">
            {result.slots.map((slot, i) => (
              <li key={i}>
                <strong>
                  {wallLabel(slot.start)} · {slot.cleaners.join(" + ")}
                </strong>
                <p>Дорога {slot.travelMinutes} мин · маршруты проверены</p>
                {slot.legs.map((l) => (
                  <p key={l.cleanerId + l.orderId}>
                    {l.cleaner}: дорога{" "}
                    {Math.ceil(l.route.durationSeconds! / 60)} мин · запас{" "}
                    {l.bufferMinutes} мин · {wallLabel(l.earliestArrival)}
                  </p>
                ))}
                <button
                  type="button"
                  className="crm-button"
                  onClick={(e) => {
                    if (onPick) {
                      onPick(slot);
                      return;
                    }
                    const form = e.currentTarget.closest("form");
                    if (!form) return;
                    const values = {
                      scheduledStart: Temporal.Instant.from(slot.start)
                        .toZonedDateTimeISO("Europe/Belgrade")
                        .toPlainDateTime()
                        .toString()
                        .slice(0, 16),
                      manualDurationMinutes: String(duration),
                      durationOverrideReason:"Выбран проверенный свободный слот",
                      requiredCleaners: String(required),
                    };
                    for (const [name, value] of Object.entries(values)) {
                      const input = form.elements.namedItem(
                        name,
                      ) as HTMLInputElement | null;
                      if (input) {
                        input.value = value;
                        input.dispatchEvent(
                          new Event("input", { bubbles: true }),
                        );
                        input.dispatchEvent(
                          new Event("change", { bubbles: true }),
                        );
                      }
                    }
                    const ids = form.querySelector<HTMLInputElement>(
                      'input[name="suggestedCleanerIds"]',
                    );
                    if (ids) ids.value = JSON.stringify(slot.cleanerIds);
                    setResult(null);
                  }}
                >
                  Поставить на это время
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </details>
  );
}
