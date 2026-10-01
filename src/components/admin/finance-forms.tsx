"use client";
import { useId, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Field, FormContext } from "./crm-form";
function Options({ labels }: { labels: Record<string, string> }) {
  return (
    <>
      {Object.entries(labels).map(([key, label]) => (
        <option key={key} value={key}>
          {label}
        </option>
      ))}
    </>
  );
}
import { expenseLabels } from "@/lib/domain/finance";
import { soilLabels, extraLabels } from "@/lib/domain/crm-types";
import type { DurationConfig } from "@/lib/domain/duration";
export async function financeMutation(command: string, payload: unknown) {
  const r = await fetch(`/api/admin/finance/${command}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return r.json();
}
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const num = (f: FormData, k: string) =>
  str(f, k) === "" ? null : Number(str(f, k));
export function FinanceForm({
  command,
  payload = {},
  children,
  button = "Сохранить",
  confirm = false,
}: {
  command: string;
  payload?: Record<string, unknown>;
  children?: ReactNode;
  button?: string;
  confirm?: boolean;
}) {
  const id = useId(),
    router = useRouter(),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState(""),
    [success, setSuccess] = useState(false),
    [confirmed, setConfirmed] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending || (confirm && !confirmed)) return;
    const f = new FormData(e.currentTarget),
      data: Record<string, unknown> = { ...payload };
    for (const k of f.keys())
      if (k !== "confirm")
        data[k] = [
          "amount",
          "finalPrice",
          "defaultCleanerPayoutPercent",
        ].includes(k)
          ? num(f, k)
          : str(f, k);
    if (command.startsWith("expense-") && command !== "expense-delete")
      data.orderId = str(f, "orderId") || null;
    setPending(true);
    setMessage("");
    setSuccess(false);
    try {
      const r = await financeMutation(command, data);
      setSuccess(r.ok);
      setMessage(
        r.ok
          ? "Сохранено"
          : [
              r.error,
              ...(r.errors ?? []).map((i: { message: string }) => i.message),
            ].join(". "),
      );
      if (r.ok) router.refresh();
    } catch {
      setMessage("Связь прервалась. Обновите страницу перед повтором.");
    } finally {
      setPending(false);
    }
  }
  return (
    <FormContext.Provider value={{ id, errors: [] }}>
      <form className="crm-form" onSubmit={submit} aria-busy={pending}>
        <fieldset className="crm-form-fields" disabled={pending}>
          {children}
          {confirm && (
            <label className="crm-check">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              Подтверждаю эту финансовую операцию
            </label>
          )}
        </fieldset>
        {message && (
          <p
            className={success ? "crm-success" : "crm-field-error"}
            role={success ? "status" : "alert"}
          >
            {message}
          </p>
        )}
        <div className="crm-form-actions">
          <button
            className="crm-button"
            disabled={pending || (confirm && !confirmed)}
          >
            {pending ? "Сохраняем…" : button}
          </button>
        </div>
      </form>
    </FormContext.Provider>
  );
}
export function ExpenseFields({
  value = {},
  orders = [],
}: {
  value?: {
    occurredAt?: string;
    category?: string;
    amount?: number;
    description?: string;
    orderId?: string | null;
  };
  orders?: { id: string; reference: string | null }[];
}) {
  return (
    <div className="crm-fields-grid">
      <Field
        name="date"
        label="Дата"
        type="date"
        value={
          value.occurredAt?.slice(0, 10) ??
          new Intl.DateTimeFormat("en-CA", {
            timeZone: "Europe/Belgrade",
          }).format(new Date())
        }
        required
      />
      <Field
        name="category"
        label="Категория"
        value={value.category ?? "OTHER"}
      >
        <Options labels={expenseLabels} />
      </Field>
      <Field
        name="amount"
        label="Сумма, RSD"
        type="number"
        min={0}
        max={10000000}
        step={0.01}
        value={value.amount}
        required
      />
      <Field name="orderId" label="Заказ · необязательно" value={value.orderId}>
        <>
          <option value="">Общий расход</option>
          {orders.map((o) => (
            <option key={o.id} value={o.id}>
              {o.reference ?? "Заказ"}
            </option>
          ))}
        </>
      </Field>
      <Field
        name="description"
        label="Описание"
        type="textarea"
        value={value.description}
        required
      />
    </div>
  );
}
const blankRule: Pick<
  DurationConfig,
  | "minArea"
  | "maxArea"
  | "referenceArea"
  | "cleanerCount"
  | "baseMinutes"
  | "minutesPerSquare"
  | "reserveMinutes"
  | "soilMultipliers"
  | "extraMinutes"
> = {
  minArea: 1,
  maxArea: 100,
  referenceArea: 100,
  cleanerCount: 2,
  baseMinutes: 150,
  minutesPerSquare: 0,
  reserveMinutes: 0,
  soilMultipliers: { LIGHT: 1, NORMAL: 1, HEAVY: 1, EXTREME: 1 },
  extraMinutes: {},
};
export function DurationRulesEditor({
  rules,
  services,
}: {
  rules: DurationConfig[];
  services: { id: string; code: string; name: string }[];
}) {
  const formId = useId();
  const router = useRouter(),
    [selected, setSelected] = useState("regular"),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState("");
  const old = rules.find((r) => r.id === selected),
    service = old
      ? (services.find((s) => s.id === old.serviceId)?.code ?? "regular")
      : selected;
  const r = old ?? {
    ...blankRule,
    ...(service === "deep"
      ? { maxArea: 50, referenceArea: 50, baseMinutes: 480 }
      : service === "regular"
        ? {}
        : { baseMinutes: undefined }),
  };
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const f = new FormData(e.currentTarget);
    const body = {
      service,
      previousId: old?.id ?? null,
      active: f.get("active") === "on",
      ...Object.fromEntries(
        [
          "minArea",
          "maxArea",
          "referenceArea",
          "cleanerCount",
          "baseMinutes",
          "minutesPerSquare",
          "reserveMinutes",
        ].map((k) => [k, num(f, k)]),
      ),
      soilMultipliers: Object.fromEntries(
        Object.keys(soilLabels).map((k) => [k, num(f, "soil-" + k)]),
      ),
      extraMinutes: Object.fromEntries(
        Object.keys(extraLabels)
          .filter((k) => str(f, "extra-" + k) !== "")
          .map((k) => [k, num(f, "extra-" + k)]),
      ),
      notes: str(f, "notes"),
    };
    setPending(true);
    setMessage("");
    try {
      const res = await financeMutation("duration-rule", body);
      setMessage(
        res.ok
          ? "Создана новая версия. Исторические заказы сохранены."
          : [
              res.error,
              ...(res.errors ?? []).map((i: { message: string }) => i.message),
            ].join(". "),
      );
      if (res.ok) router.refresh();
    } catch {
      setMessage("Не удалось сохранить.");
    } finally {
      setPending(false);
    }
  }
  return (
    <FormContext.Provider value={{ id: formId, errors: [] }}>
      <section className="crm-section">
        <h2>Правила длительности</h2>
        <p className="crm-hint">
          Расчёт воспроизводим: (база + дополнительные м² × минут/м²) ×
          загрязнение + extras; округление вверх до 5 минут. Количество клинеров
          должно совпасть с правилом. Резерв хранится отдельно.
        </p>
        <p>
          Ориентиры: поддерживающая до 100 м², 2 клинера — 150 минут;
          генеральная около 50 м², 2 клинера — полный день. Для второго шаблона
          выбрано 480 минут — проверьте длину рабочего дня. Шаблоны не
          активируются автоматически.
        </p>
        <label className="crm-field">
          Создать правило или новую версию
          <select
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value);
              setMessage("");
            }}
          >
            {services.map((s) => (
              <option key={s.id} value={s.code}>
                {s.name} · новое правило
              </option>
            ))}
            {rules.map((r) => (
              <option key={r.id} value={r.id}>
                {services.find((s) => s.id === r.serviceId)?.name} · v
                {r.version} · {r.minArea}–{r.maxArea} м² · {r.cleanerCount}{" "}
                клинера
              </option>
            ))}
          </select>
        </label>
        <form onSubmit={save} className="crm-form" key={selected}>
          <fieldset className="crm-form-fields" disabled={pending}>
            <div className="crm-fields-grid">
              {(
                [
                  ["minArea", "Площадь от, м²", 1, 10000, 0.01],
                  ["maxArea", "Площадь до, м²", 1, 10000, 0.01],
                  ["referenceArea", "Базовая площадь, м²", 0, 10000, 0.01],
                  ["cleanerCount", "Клинеров", 1, 30, 1],
                  ["baseMinutes", "Базовые минуты", 1, 1440, 1],
                  [
                    "minutesPerSquare",
                    "Минут на м² сверх базовой площади",
                    0,
                    1440,
                    0.0001,
                  ],
                  ["reserveMinutes", "Резерв, минут", 0, 240, 1],
                ] as const
              ).map(([k, label, min, max, step]) => (
                <Field
                  key={k}
                  name={k}
                  label={label}
                  type="number"
                  min={min}
                  max={max}
                  step={step}
                  value={r[k]}
                  required
                />
              ))}
            </div>
            <h3>Загрязнение</h3>
            <div className="crm-fields-grid">
              {Object.entries(soilLabels).map(([k, label]) => (
                <Field
                  key={k}
                  name={"soil-" + k}
                  label={label + " · коэффициент"}
                  type="number"
                  min={0.1}
                  max={10}
                  step={0.01}
                  value={r.soilMultipliers[k]}
                  required
                />
              ))}
            </div>
            <h3>Дополнения · минут на единицу</h3>
            <p className="crm-hint">
              Пустое поле означает, что дополнение ещё не калибровано. Заказ с
              таким дополнением потребует ручной длительности. Ноль означает
              явно настроенное отсутствие дополнительного времени.
            </p>
            <div className="crm-fields-grid">
              {Object.entries(extraLabels).map(([k, label]) => (
                <Field
                  key={k}
                  name={"extra-" + k}
                  label={label}
                  type="number"
                  min={0}
                  max={1440}
                  step={1}
                  value={r.extraMinutes[k]}
                />
              ))}
            </div>
            <Field
              name="notes"
              label="Обоснование и ограничения правила"
              type="textarea"
            />
            <label className="crm-check">
              <input name="active" type="checkbox" />
              Активировать эту версию. Предыдущее выбранное правило станет
              неактивным.
            </label>
          </fieldset>
          {message && <p role="status">{message}</p>}
          <button className="crm-button" disabled={pending}>
            Сохранить новую версию
          </button>
        </form>
        <h3>Версии</h3>
        {rules.length ? (
          rules.map((r) => (
            <div className="finance-rule" key={r.id}>
              <p>
                <b>
                  {services.find((s) => s.id === r.serviceId)?.name} · v
                  {r.version}
                </b>
                <br />
                {r.minArea}–{r.maxArea} м² · {r.cleanerCount} клинера · база{" "}
                {r.baseMinutes} мин · {r.active ? "Активна" : "Неактивна"}
              </p>
              <FinanceForm
                command="duration-active"
                payload={{ id: r.id, active: !r.active }}
                button={r.active ? "Деактивировать" : "Активировать"}
              />
            </div>
          ))
        ) : (
          <p className="crm-hint">
            Активных правил пока нет. Владелец подтверждает диапазоны и
            параметры.
          </p>
        )}
      </section>
    </FormContext.Provider>
  );
}
