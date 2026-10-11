"use client";
import { useEffect, useRef, useState } from "react";
import { Temporal } from "@js-temporal/polyfill";
import { ConflictList } from "./order-planning";
import {
  weekdays,
  type CalendarOrder,
  type CrewOption,
  type SchedulingIssue,
} from "@/lib/domain/scheduling-types";
import type { RepeatInput } from "@/lib/domain/calendar-repeat";
type Preview = {
  rows: {
    start: string;
    issues: SchedulingIssue[];
    duplicate: boolean;
    existing?: boolean;
  }[];
  count: number;
  client: string;
  address: string;
  service: string;
  area: number;
  extras: { name: string; quantity: number }[];
  copiedPrice: number | null;
  currentPrice: number | null;
  price: number | null;
  duration: number | null;
  requiredCleaners: number;
};
export async function repeatRequest(action: string, input: unknown) {
  const response = await fetch("/api/admin/calendar/repeat/" + action, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return response.json();
}
export function RepeatEditor({
  order,
  date,
  cleaners,
  onClose,
  onSaved,
}: {
  order: CalendarOrder;
  date: string;
  cleaners: CrewOption[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    busy = useRef(false);
  const [input, setInput] = useState<RepeatInput>(() => ({
    sourceId: order.id,
    expectedUpdatedAt: order.updatedAt,
    date,
    time: order.localStart.slice(11, 16) || "14:30",
    weekly: false,
    weekdays: [Temporal.PlainDate.from(date).dayOfWeek],
    until: Temporal.PlainDate.from(date)
      .add({ weeks: 8 })
      .subtract({ days: 1 })
      .toString(),
    cleanerIds: order.cleaners.map((c) => c.id),
    finalPrice: null,
    comment: "",
    allowDuplicate: false,
    requestId: crypto.randomUUID(),
  }));
  const [preview, setPreview] = useState<Preview | null>(null),
    [error, setError] = useState(""),
    [pending, setPending] = useState(true),
    [created, setCreated] = useState(false);
  const initialRequest = useRef(input);
  useEffect(() => {
    dialog.current?.showModal();
    busy.current = true;
    let active = true;
    repeatRequest("preview", initialRequest.current)
      .then((result) => {
        if (active) {
          if (result.ok) setPreview(result);
          else setError(result.error);
        }
      })
      .catch(() => {
        if (active)
          setError("Не удалось загрузить просмотр. Повторите проверку.");
      })
      .finally(() => {
        if (active) {
          busy.current = false;
          setPending(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);
  function change(patch: Partial<RepeatInput>) {
    setInput((v) => ({ ...v, ...patch }));
    setPreview(null);
    setError("");
  }
  async function execute(action: "preview" | "create") {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const result = await repeatRequest(action, input);
      if (!result.ok) {
        setError(result.error);
        if (action === "create") setPreview(null);
        return;
      }
      if (result.created) {
        setCreated(true);
        await onSaved();
        onClose();
      } else setPreview(result);
    } catch {
      setError(
        "Нет ответа сервера. Повторите запрос: повторное подтверждение не создаст дубли.",
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  const blocked = preview?.rows.some(
    (r) => r.issues.length || (r.duplicate && !input.allowDuplicate),
  );
  return (
    <dialog
      ref={dialog}
      className="schedule-dialog repeat-dialog"
      onCancel={onClose}
    >
      <div className="admin-section-heading">
        <h2>{input.weekly ? "Повторять уборку" : "Повторить уборку"}</h2>
        <button
          type="button"
          disabled={pending}
          onClick={onClose}
          aria-label="Закрыть"
        >
          ×
        </button>
      </div>
      <p>
        {order.client} · {order.service}
        <br />
        {order.address}
      </p>
      <p className="crm-hint">
        Новые самостоятельные черновики. Уведомление клиенту — после
        подтверждения заказа. Europe/Belgrade.
      </p>
      <fieldset disabled={pending || created} className="repeat-fields">
        <label>
          Дата
          <input
            type="date"
            value={input.date}
            onChange={(e) => change({ date: e.target.value })}
          />
        </label>
        <label>
          Время
          <input
            type="time"
            value={input.time}
            onChange={(e) => change({ time: e.target.value })}
          />
        </label>
        <label className="crm-check">
          <input
            type="checkbox"
            checked={input.weekly}
            onChange={(e) => change({ weekly: e.target.checked })}
          />
          Сделать регулярной · еженедельно
        </label>
        {input.weekly && (
          <>
            <div className="repeat-weekdays">
              {weekdays.map((label, i) => (
                <label key={label}>
                  <input
                    type="checkbox"
                    checked={input.weekdays.includes(i + 1)}
                    onChange={(e) =>
                      change({
                        weekdays: e.target.checked
                          ? [...input.weekdays, i + 1]
                          : input.weekdays.filter((d) => d !== i + 1),
                      })
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
            <label>
              До какой даты повторять
              <input
                type="date"
                min={input.date}
                max={
                  input.date
                    ? Temporal.PlainDate.from(input.date)
                        .add({ weeks: 26 })
                        .toString()
                    : undefined
                }
                value={input.until}
                onChange={(e) => change({ until: e.target.value })}
              />
            </label>
            <small>
              До 26 недель и 64 уборок. Все даты появятся в просмотре.
            </small>
          </>
        )}
        <label>
          Стоимость, RSD
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Сохранить согласованную цену"
            value={input.finalPrice ?? ""}
            onChange={(e) =>
              change({
                finalPrice:
                  e.target.value === "" ? null : Number(e.target.value),
              })
            }
          />
        </label>
        <label>
          Комментарий
          <textarea
            maxLength={2000}
            value={input.comment}
            onChange={(e) => change({ comment: e.target.value })}
          />
        </label>
        <p>Команда · требуется {order.requiredCleaners}</p>
        <div className="schedule-crew-picker">
          {cleaners.map((c) => (
            <label key={c.id} className="crm-check">
              <input
                type="checkbox"
                checked={input.cleanerIds.includes(c.id)}
                disabled={!c.active}
                onChange={(e) =>
                  change({
                    cleanerIds: e.target.checked
                      ? [...input.cleanerIds, c.id]
                      : input.cleanerIds.filter((id) => id !== c.id),
                  })
                }
              />
              {c.name}
              {!c.active && " · неактивен"}
            </label>
          ))}
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="crm-form-error">
          {error}
        </p>
      )}
      {preview && (
        <section aria-label="Предварительный просмотр">
          <p>
            Клиент: {preview.client}
            <br />
            Услуга: {preview.service} · {preview.area} м²
            <br />
            Длительность: {preview.duration ?? "не задана"} мин
            <br />
            Дополнительные услуги:{" "}
            {preview.extras
              .map((e) => `${e.name} × ${e.quantity}`)
              .join(", ") || "нет"}
            <br />
            Скопированная цена: {preview.copiedPrice ?? "не задана"} RSD
            <br />
            Цена по текущему прайсу: {preview.currentPrice ?? "недоступна"} RSD
            <br />
            Применить: {preview.price ?? "не задана"} RSD
          </p>
          {preview.currentPrice !== null && (
            <button
              type="button"
              onClick={() => change({ finalPrice: preview.currentPrice })}
            >
              Использовать текущий прайс
            </button>
          )}
          <p>
            <strong>Будет создано заказов: {preview.count}</strong>
          </p>
          <ol className="repeat-preview">
            {preview.rows.map((r) => (
              <li key={r.start}>
                <strong>{r.start.replace("T", " · ")}</strong> ·{" "}
                {r.existing
                  ? "Исходная уборка · сохраняется"
                  : r.issues.some((i) => i.code === "UNDERSTAFFED")
                    ? "Требует выбора команды"
                    : r.issues.length
                      ? "На это время есть конфликт"
                      : "Доступна"}
                {r.duplicate && <p>Возможный дубль на эту дату.</p>}
                <ConflictList issues={r.issues} cleaners={cleaners} />
              </li>
            ))}
          </ol>
          {preview.rows.some((r) => r.duplicate) && (
            <label className="crm-check">
              <input
                type="checkbox"
                checked={input.allowDuplicate}
                onChange={(e) =>
                  setInput((v) => ({ ...v, allowDuplicate: e.target.checked }))
                }
              />
              Подтверждаю создание отдельной уборки рядом с существующей
            </label>
          )}
        </section>
      )}
      <div className="repeat-actions">
        <button type="button" disabled={pending} onClick={onClose}>
          Отмена
        </button>
        <button
          type="button"
          className="crm-button"
          disabled={pending || created}
          onClick={() => void execute("preview")}
        >
          {pending ? "Проверяем…" : "Предварительный просмотр"}
        </button>
        {preview && (
          <button
            type="button"
            className="crm-button"
            disabled={pending || blocked || created}
            onClick={() => void execute("create")}
          >
            {input.weekly
              ? `Создать ${preview.count} уборок`
              : "Создать уборку"}
          </button>
        )}
      </div>
    </dialog>
  );
}
export function RepeatActions({
  order,
  cleaners,
}: {
  order: CalendarOrder;
  cleaners: CrewOption[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="crm-button"
        onClick={() => setOpen(true)}
      >
        Повторить уборку / Сделать регулярной
      </button>
      {open && (
        <RepeatEditor
          order={order}
          date={Temporal.PlainDate.from(
            order.localStart.slice(0, 10) ||
              Temporal.Now.plainDateISO("Europe/Belgrade"),
          )
            .add({ weeks: 1 })
            .toString()}
          cleaners={cleaners}
          onClose={() => setOpen(false)}
          onSaved={() => {
            window.location.reload();
          }}
        />
      )}
      {order.repeatSeriesId && (
        <SeriesActions seriesId={order.repeatSeriesId} cleaners={cleaners} />
      )}
    </>
  );
}
type SeriesScope = {
  updatedAt: string;
  scopeVersion: string;
  count: number;
  stopped?: boolean;
  orders?: { id: string; start: string; status: string }[];
  rows?: { id: string; start: string; issues: SchedulingIssue[] }[];
};
function SeriesActions({
  seriesId,
  cleaners,
}: {
  seriesId: string;
  cleaners: CrewOption[];
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    busy = useRef(false);
  const [scope, setScope] = useState<SeriesScope | null>(null),
    [time, setTime] = useState(""),
    [price, setPrice] = useState(""),
    [team, setTeam] = useState<string[] | null>(null),
    [comment, setComment] = useState(""),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false),
    [previewed, setPreviewed] = useState(false),
    [stop, setStop] = useState(false);
  const payload = () => ({
    seriesId,
    expectedUpdatedAt: scope?.updatedAt,
    scopeVersion: scope?.scopeVersion,
    confirmCount: scope?.count,
    ...(time ? { time } : {}),
    ...(price ? { price: Number(price) } : {}),
    ...(team === null ? {} : { cleanerIds: team }),
    ...(comment ? { comment } : {}),
  });
  async function execute(action: string) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const result = await repeatRequest(
        action,
        action === "series-info" ? { seriesId } : payload(),
      );
      if (!result.ok) {
        setError(result.error);
        setPreviewed(false);
        return;
      }
      if (action === "series-info") {
        setScope(result);
        setStop(false);
        setPreviewed(false);
        dialog.current?.showModal();
      } else if (action === "series-preview") {
        setScope(result);
        setPreviewed(true);
      } else window.location.reload();
    } catch {
      setError("Не удалось получить ответ. Обновите просмотр серии.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <>
      <button
        type="button"
        className="crm-button"
        disabled={pending}
        onClick={() => void execute("series-info")}
      >
        Будущие уборки серии
      </button>
      {error && <p role="alert">{error}</p>}
      <dialog ref={dialog} className="schedule-dialog repeat-dialog">
        <h2>Будущие уборки серии</h2>
        <p>
          Изменение и отмена одной уборки выполняются в её карточке. Здесь
          действие затронет <strong>{scope?.count ?? 0} будущих уборок</strong>.
        </p>
        <fieldset disabled={pending || scope?.stopped}>
          <label>
            Новое время
            <input
              type="time"
              value={time}
              onChange={(e) => {
                setTime(e.target.value);
                setPreviewed(false);
              }}
            />
          </label>
          <label>
            Новая цена, RSD
            <input
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => {
                setPrice(e.target.value);
                setPreviewed(false);
              }}
            />
          </label>
          <label>
            Комментарий
            <textarea
              value={comment}
              maxLength={2000}
              onChange={(e) => {
                setComment(e.target.value);
                setPreviewed(false);
              }}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={team !== null}
              onChange={(e) => {
                setTeam(e.target.checked ? [] : null);
                setPreviewed(false);
              }}
            />
            Изменить команду будущих уборок
          </label>
          {team !== null && (
            <div className="schedule-crew-picker">
              {cleaners
                .filter((c) => c.active)
                .map((c) => (
                  <label key={c.id}>
                    <input
                      type="checkbox"
                      checked={team.includes(c.id)}
                      onChange={(e) => {
                        setTeam(
                          e.target.checked
                            ? [...team, c.id]
                            : team.filter((id) => id !== c.id),
                        );
                        setPreviewed(false);
                      }}
                    />
                    {c.name}
                  </label>
                ))}
            </div>
          )}
        </fieldset>
        <ol className="repeat-preview">
          {(scope?.rows ?? scope?.orders ?? []).map((o) => (
            <li key={o.id}>
              <a href={"/admin/orders/" + o.id}>
                {o.start.replace("T", " · ")}
              </a>
              {"issues" in o && (
                <ConflictList issues={o.issues} cleaners={cleaners} />
              )}
            </li>
          ))}
        </ol>
        {error && <p role="alert">{error}</p>}
        {scope?.stopped && <p>Повторение остановлено.</p>}
        {stop && (
          <p role="alert">
            Подтвердите остановку: будут отменены {scope?.count} будущих уборок.
            Завершённые уборки сохраняются.
          </p>
        )}
        <div className="repeat-actions">
          <button
            type="button"
            disabled={pending}
            onClick={() => dialog.current?.close()}
          >
            Закрыть
          </button>
          <button
            type="button"
            disabled={pending || scope?.stopped}
            onClick={() => {
              setStop(false);
              void execute("series-preview");
            }}
          >
            Проверить изменения
          </button>
          {previewed && !stop && (
            <button
              type="button"
              className="crm-button"
              disabled={
                pending || scope?.rows?.some((r) => r.issues.length > 0)
              }
              onClick={() => void execute("series-update")}
            >
              Изменить {scope?.count} уборок
            </button>
          )}
          {!scope?.stopped && (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (stop) void execute("series-stop");
                else setStop(true);
              }}
            >
              {stop
                ? `Отменить ${scope?.count} будущих уборок`
                : "Остановить повторение"}
            </button>
          )}
        </div>
      </dialog>
    </>
  );
}
