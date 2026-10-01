"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { scheduleMutation } from "./scheduling-forms";
import {
  closedStatuses,
  wallLabel,
  type CalendarOrder,
  type CrewOption,
  type SchedulingIssue,
} from "@/lib/domain/scheduling-types";
import { orderLabels, orderTransitions } from "@/lib/domain/crm-types";
export function ConflictList({
  issues,
  cleaners = [],
}: {
  issues: SchedulingIssue[];
  cleaners?: CrewOption[];
}) {
  return issues.length ? (
    <ul className="schedule-conflicts">
      {issues.map((i) => (
        <li key={i.key} data-severity={i.severity}>
          <strong>{i.severity === "ERROR" ? "Конфликт" : "Внимание"}</strong> ·{" "}
          {i.cleanerId && (
            <>
              {cleaners.find((c) => c.id === i.cleanerId)?.name ?? "Клинер"}{" "}
              ·{" "}
            </>
          )}
          {i.message}
          {i.orderId && (
            <Link href={"/admin/orders/" + i.orderId}>Другой заказ →</Link>
          )}
        </li>
      ))}
    </ul>
  ) : null;
}
export type PlanDraft = {
  start?: string;
  cleanerIds?: string[];
  duration?: number;
  requiredCleaners?: number;
  source?: "EDITOR" | "CALENDAR_DRAG" | "UNPLACE";
  issues?: SchedulingIssue[];
};
export function PlanEditor({
  order,
  cleaners,
  draft = {},
  onClose,
  onSaved,
}: {
  order: CalendarOrder;
  cleaners: CrewOption[];
  draft?: PlanDraft;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    busy = useRef(false),
    id = useId();
  const [start, setStart] = useState(draft.start ?? order.localStart),
    [duration, setDuration] = useState(
      draft.duration !== undefined
        ? String(draft.duration)
        : order.manualDuration === null
          ? ""
          : String(order.manualDuration),
    );
  const [source, setSource] = useState(draft.source ?? "EDITOR");
  const [ids, setIds] = useState(
      draft.cleanerIds ?? order.cleaners.map((c) => c.id),
    ),
    [status, setStatus] = useState(order.status);
  const [issues, setIssues] = useState(draft.issues ?? []),
    [ack, setAck] = useState(false),
    [reason, setReason] = useState(""),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const reset = () => {
    setIssues([]);
    setAck(false);
  };
  async function save(intent: PlanDraft["source"] = source, clear = false) {
    if (clear) {
      setStart("");
      setSource("UNPLACE");
    }
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const result = await scheduleMutation("order-plan", {
        id: order.id,
        expectedUpdatedAt: order.updatedAt,
        scheduledStart: clear ? null : start || null,
        manualDurationMinutes: duration ? Number(duration) : null,
        ...(draft.requiredCleaners === undefined
          ? {}
          : { requiredCleaners: draft.requiredCleaners }),
        cleanerIds: ids,
        status,
        source: intent,
        acknowledged: ack
          ? issues.filter((i) => i.severity === "WARNING").map((i) => i.key)
          : [],
        overrideReason: ack ? reason : null,
      });
      if (!result.ok) {
        setIssues(result.issues ?? []);
        setError(result.error ?? "Не удалось сохранить");
        return;
      }
      await onSaved();
      onClose();
    } catch {
      setError("Связь прервалась. Обновите данные заказа перед повтором.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="schedule-dialog"
      aria-labelledby={id + "-title"}
      onCancel={onClose}
    >
      <div className="schedule-dialog-heading">
        <div>
          <small>LumaClean / Планирование</small>
          <h2 id={id + "-title"}>{order.reference}</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Закрыть панель">
          ×
        </button>
      </div>
      <p>
        {order.client} · {order.service}
        <br />
        <span className="crm-hint">{order.address}</span>
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        aria-busy={pending}
      >
        {order.logistics?.map((l) => (
          <details key={l.cleaner} className="routing-details">
            <summary>{l.cleaner} · логистика</summary>
            <p>
              {l.origin} → {l.destination}
            </p>
            <p>
              {l.minutes === null
                ? "Маршрут не подтверждён"
                : `Дорога ${l.minutes} мин · запас ${l.buffer} мин · прибытие ~${wallLabel(l.arrival)}`}
            </p>
            <small>Google · расчёт {wallLabel(l.calculatedAt)}</small>
          </details>
        ))}
        <fieldset disabled={pending} className="crm-form-fields">
          {order.scheduleMode === "FLEXIBLE" && (
            <p className="schedule-window">
              Обещанное окно: {wallLabel(order.windowFrom)} —{" "}
              {wallLabel(order.windowTo)}. Оно сохраняется при размещении.
            </p>
          )}
          <div className="crm-fields-grid">
            <label className="crm-field" htmlFor={id + "-start"}>
              Дата и время · Белград
              <input
                id={id + "-start"}
                name="scheduledStart"
                type="datetime-local"
                value={start}
                onInput={(e) => {
                  setStart(e.currentTarget.value);
                  setSource("EDITOR");
                  reset();
                }}
                onChange={(e) => {
                  setStart(e.target.value);
                  setSource("EDITOR");
                  reset();
                }}
                required={order.scheduleMode === "FIXED"}
              />
            </label>
            <label className="crm-field" htmlFor={id + "-duration"}>
              Плановая длительность, минут
              <input
                id={id + "-duration"}
                name="manualDurationMinutes"
                type="number"
                min={1}
                max={1440}
                step={1}
                value={duration}
                onInput={(e) => {
                  setDuration(e.currentTarget.value);
                  reset();
                }}
                placeholder={
                  order.duration !== null
                    ? "Расчётная: " + order.duration
                    : "Длительность не задана"
                }
                onChange={(e) => {
                  setDuration(e.target.value);
                  reset();
                }}
              />
            </label>
          </div>
          <div
            className="schedule-duration-presets"
            aria-label="Быстрая длительность"
          >
            {[
              [60, "1 ч"],
              [90, "1:30"],
              [120, "2 ч"],
              [150, "2:30"],
              [180, "3 ч"],
            ].map(([minutes, label]) => (
              <button
                type="button"
                key={minutes}
                aria-pressed={duration === String(minutes)}
                onClick={() => {
                  setDuration(String(minutes));
                  reset();
                }}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setDuration("");
                reset();
              }}
            >
              Очистить ручное
            </button>
          </div>
          <p className="crm-hint">
            Ручное значение имеет приоритет. Без него используется существующая
            расчётная длительность; новая формула не применяется.
          </p>
          <h3>
            Назначено {ids.length} / требуется{" "}
            {draft.requiredCleaners ?? order.requiredCleaners}
          </h3>
          <div className="schedule-crew-picker">
            {cleaners.map((c) => (
              <label className="crm-check" key={c.id}>
                <input
                  type="checkbox"
                  name="cleanerIds"
                  value={c.id}
                  checked={ids.includes(c.id)}
                  disabled={!c.active && !ids.includes(c.id)}
                  onChange={(e) => {
                    setIds((v) =>
                      e.target.checked
                        ? [...v, c.id]
                        : v.filter((i) => i !== c.id),
                    );
                    reset();
                  }}
                />
                {c.name}
                {!c.active && " · неактивен"}
              </label>
            ))}
          </div>
          {!cleaners.length && (
            <p>Сначала добавьте клинера в разделе команды.</p>
          )}
          <label className="crm-field" htmlFor={id + "-status"}>
            Статус заказа
            <select
              id={id + "-status"}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as typeof status);
                reset();
              }}
            >
              {[
                order.status,
                ...orderTransitions[order.status].filter(
                  (s) => s !== "CANCELLED" && s !== "NO_SHOW",
                ),
              ].map((s) => (
                <option value={s} key={s}>
                  {orderLabels[s]}
                </option>
              ))}
            </select>
          </label>
          <p className="crm-hint">
            Отмена и неявка с причиной доступны в карточке заказа.
          </p>
          <p className="schedule-travel">
            При сохранении проверяются маршруты каждого участника команды.
            Непроверенная дорога требует подтверждения с причиной.
          </p>
          <ConflictList issues={issues} cleaners={cleaners} />
          {issues.length > 0 && !issues.some((i) => i.severity === "ERROR") && (
            <div className="schedule-issues">
              <label className="crm-check">
                <input
                  type="checkbox"
                  checked={ack}
                  onChange={(e) => setAck(e.target.checked)}
                />
                Подтверждаю перечисленные предупреждения
              </label>
              <label className="crm-field" htmlFor={id + "-reason"}>
                Причина подтверждения
                <textarea
                  id={id + "-reason"}
                  value={reason}
                  maxLength={1000}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
            </div>
          )}
        </fieldset>
        {error && (
          <p role="alert" className="crm-form-error">
            {error}
          </p>
        )}
        <div className="schedule-dialog-actions">
          <button className="crm-button" disabled={pending}>
            {pending ? "Сохраняем…" : "Сохранить планирование"}
          </button>
          {order.scheduleMode === "FLEXIBLE" && order.start && (
            <button
              type="button"
              disabled={pending}
              onClick={() => void save("UNPLACE", true)}
            >
              Снять с календаря
            </button>
          )}
          <Link href={"/admin/orders/" + order.id}>Открыть заказ →</Link>
        </div>
      </form>
    </dialog>
  );
}
export function OrderPlanningPanel({
  order,
  cleaners,
  overrides = [],
}: {
  order: CalendarOrder;
  cleaners: CrewOption[];
  overrides?: { id: string; reason: string; createdAt: string; name: string }[];
}) {
  const [open, setOpen] = useState(false),
    router = useRouter();
  return (
    <section className="crm-section">
      <div className="admin-section-heading">
        <h2>Команда и планирование</h2>
        {!closedStatuses.includes(order.status) && (
          <button className="crm-button" onClick={() => setOpen(true)}>
            Время / клинеры
          </button>
        )}
      </div>
      <p>
        Назначено {order.cleaners.length} / требуется {order.requiredCleaners}
      </p>
      <p>
        {order.cleaners
          .map((c) => c.name + (c.active ? "" : " · неактивен"))
          .join(", ") || "Клинеры не назначены"}
      </p>
      <p>
        {order.duration !== null
          ? order.duration + " минут"
          : "Длительность не задана"}{" "}
        · {wallLabel(order.start)}
        {order.end && " — " + wallLabel(order.end)}
      </p>
      <ConflictList issues={order.issues} cleaners={cleaners} />
      <p className="schedule-travel">
        Время дороги и актуальность расчёта — в логистике заказа.
      </p>
      {overrides.length > 0 && (
        <details>
          <summary>Подтверждения предупреждений</summary>
          <ul>
            {overrides.map((o) => (
              <li key={o.id}>
                <strong>{o.name}</strong> · {wallLabel(o.createdAt)}
                <p>{o.reason}</p>
              </li>
            ))}
          </ul>
        </details>
      )}
      {open && (
        <PlanEditor
          key={order.updatedAt}
          order={order}
          cleaners={cleaners}
          onClose={() => setOpen(false)}
          onSaved={() => router.refresh()}
        />
      )}
    </section>
  );
}
