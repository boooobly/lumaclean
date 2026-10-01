"use client";
import { useId, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Field, FormContext } from "./crm-form";
import {
  travelLabels,
  weekdays,
  minuteLabel,
} from "@/lib/domain/scheduling-types";
import type { SchedulingCommand } from "@/lib/validation/scheduling";
import { AddressAutocomplete } from "./address-autocomplete";
type FormErrors = { field: string; message: string }[];
export type MutationResult = {
  ok: boolean;
  id?: string;
  error?: string;
  errors?: FormErrors;
  issues?: import("@/lib/domain/scheduling-types").SchedulingIssue[];
};
export async function scheduleMutation(
  command: SchedulingCommand,
  payload: unknown,
): Promise<MutationResult> {
  const response = await fetch("/api/admin/scheduling/" + command, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return await response
    .json()
    .catch(() => ({ ok: false, error: "Не удалось прочитать ответ сервера." }));
}
export function ScheduleForm({
  command,
  payload,
  button,
  redirectTo,
  children,
}: {
  command: SchedulingCommand;
  payload: (f: FormData) => unknown;
  button: string;
  redirectTo?: string;
  children?: ReactNode;
}) {
  const router = useRouter(),
    id = useId(),
    busy = useRef(false);
  const [pending, setPending] = useState(false),
    [result, setResult] = useState<MutationResult | null>(null);
  const errors = (result?.errors ?? []).map((e) => ({
    ...e,
    field: e.field.startsWith("cleaner.") ? e.field.slice(8) : e.field,
  }));
  return (
    <FormContext.Provider value={{ id, errors }}>
      <form
        className="crm-form"
        aria-busy={pending}
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy.current) return;
          busy.current = true;
          setPending(true);
          setResult(null);
          try {
            const res = await scheduleMutation(
              command,
              payload(new FormData(e.currentTarget)),
            );
            setResult(res);
            if (res.ok) {
              if (redirectTo)
                router.push(redirectTo.replace("[id]", res.id ?? ""));
              router.refresh();
            }
          } catch {
            setResult({
              ok: false,
              error:
                "Связь прервалась. Данные формы сохранены — повторите отправку.",
            });
          } finally {
            busy.current = false;
            setPending(false);
          }
        }}
      >
        <fieldset disabled={pending} className="crm-form-fields">
          {children}
        </fieldset>
        {result && (
          <div
            className={result.ok ? "crm-success" : "crm-form-error"}
            role={result.ok ? "status" : "alert"}
          >
            {result.ok ? "Сохранено" : result.error}
            <ul>
              {errors.map((e, i) => (
                <li key={i}>{e.message}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="crm-form-actions">
          <button className="crm-button" disabled={pending}>
            {pending ? "Сохраняем…" : button}
          </button>
        </div>
      </form>
    </FormContext.Provider>
  );
}
const text = (f: FormData, key: string) => String(f.get(key) ?? "").trim();
const optional = (f: FormData, key: string) => text(f, key) || null;
const number = (f: FormData, key: string) =>
  text(f, key) ? Number(text(f, key)) : null;
type CleanerValues = {
  name?: string;
  phone?: string;
  additionalContact?: string | null;
  homeAddress?: string | null;
  homeConfirmed?: boolean;
  languages?: string[];
  skills?: string[];
  internalRating?: number | null;
  payoutPercent?: number | null;
  notes?: string | null;
  defaultTravelMode?: keyof typeof travelLabels;
};
export function CleanerForm({
  id,
  value = {},
}: {
  id?: string;
  value?: CleanerValues;
}) {
  return (
    <ScheduleForm
      command={id ? "cleaner-update" : "cleaner-create"}
      button={id ? "Сохранить клинера" : "Создать клинера"}
      redirectTo={id ? undefined : "/admin/cleaners/[id]"}
      payload={(f) => ({
        ...(id ? { id } : {}),
        cleaner: {
          name: text(f, "name"),
          phone: text(f, "phone"),
          additionalContact: optional(f, "additionalContact"),
          homeAddress: optional(f, "homeAddress"),
          homeLocationProof: optional(f, "homeLocationProof"),
          languages: [
            ...new Set(
              text(f, "languages")
                .split(",")
                .map((v) => v.trim())
                .filter(Boolean),
            ),
          ],
          skills: [
            ...new Set(
              text(f, "skills")
                .split(",")
                .map((v) => v.trim())
                .filter(Boolean),
            ),
          ],
          internalRating: number(f, "internalRating"),
          payoutPercent: number(f, "payoutPercent"),
          notes: optional(f, "notes"),
          defaultTravelMode: text(f, "defaultTravelMode"),
        },
      })}
    >
      <div className="crm-fields-grid">
        <Field name="name" label="Имя клинера" value={value.name} required />
        <Field
          name="phone"
          label="Телефон"
          type="tel"
          value={value.phone}
          required
        />
        <Field
          name="additionalContact"
          label="Дополнительный контакт"
          value={value.additionalContact}
        />
        <AddressAutocomplete
          name="homeAddress"
          proofName="homeLocationProof"
          label="Домашний / стартовый адрес"
          value={value.homeAddress}
          confirmed={value.homeConfirmed}
        />
        <Field
          name="defaultTravelMode"
          label="Основной транспорт"
          value={value.defaultTravelMode ?? "PUBLIC_TRANSIT"}
        >
          {Object.entries(travelLabels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </Field>
        <Field
          name="languages"
          label="Языки · через запятую"
          value={value.languages?.join(", ")}
        />
        <Field
          name="skills"
          label="Навыки · через запятую"
          value={value.skills?.join(", ")}
        />
        <Field
          name="internalRating"
          label="Внутренний рейтинг · 0–5"
          type="number"
          min={0}
          max={5}
          step={0.01}
          value={value.internalRating}
        />
        <Field
          name="payoutPercent"
          label="Индивидуальный процент выплаты · %"
          type="number"
          min={0}
          max={100}
          step={0.01}
          value={value.payoutPercent}
        />
        <Field
          name="notes"
          label="Внутренние заметки"
          type="textarea"
          value={value.notes}
        />
      </div>
      <p className="crm-hint">
        Координаты не нужны. Процент можно оставить пустым; выплаты на этом
        этапе не рассчитываются.
      </p>
    </ScheduleForm>
  );
}
export function CleanerActivity({
  id,
  active,
}: {
  id: string;
  active: boolean;
}) {
  return (
    <ScheduleForm
      command="cleaner-active"
      button={active ? "Деактивировать клинера" : "Активировать клинера"}
      payload={() => ({ id, active: !active })}
    />
  );
}
type AvailabilityValue = {
  id: string;
  kind: "WEEKLY" | "AVAILABLE" | "UNAVAILABLE";
  weekday: number | null;
  date: string | null;
  startMinute: number | null;
  endMinute: number | null;
  reason: string | null;
};
function timeValue(n: number | null) {
  return n === null ? "" : n === 1440 ? "00:00" : minuteLabel(n);
}
function timeMinute(v: string, end = false) {
  if (!/^\d{2}:\d{2}$/.test(v)) return null;
  const [h, m] = v.split(":").map(Number);
  return end && h === 0 && m === 0 ? 1440 : h * 60 + m;
}
export function AvailabilityEditor({
  id,
  rows,
}: {
  id: string;
  rows: AvailabilityValue[];
}) {
  const days = weekdays.map((_, index) =>
    rows.find((r) => r.kind === "WEEKLY" && r.weekday === index + 1),
  );
  const [working, setWorking] = useState(
    days.map((r) => r?.startMinute !== null && r?.startMinute !== undefined),
  );
  const [exceptionKind, setExceptionKind] = useState<
      "AVAILABLE" | "UNAVAILABLE"
    >("UNAVAILABLE"),
    [allDay, setAllDay] = useState(true);
  const dated = rows.filter((r) => r.kind !== "WEEKLY"),
    scope = useId();
  return (
    <>
      <section className="crm-section">
        <h2>Недельный график</h2>
        <p className="crm-hint">
          Europe/Belgrade · часы по местному времени. Снятая отметка означает
          выходной. 00:00 в конце — полночь следующего дня.
        </p>
        <ScheduleForm
          command="availability-week"
          button="Сохранить недельный график"
          payload={(f) => ({
            id,
            week: weekdays.map((_, i) => ({
              weekday: i + 1,
              working: working[i],
              startMinute: working[i]
                ? timeMinute(text(f, "week." + i + ".startMinute"))
                : null,
              endMinute: working[i]
                ? timeMinute(text(f, "week." + i + ".endMinute"), true)
                : null,
            })),
          })}
        >
          <div className="availability-week">
            {weekdays.map((day, i) => (
              <div key={day} className="availability-row">
                <label className="crm-check">
                  <input
                    type="checkbox"
                    checked={working[i]}
                    onChange={(e) =>
                      setWorking((v) =>
                        v.map((w, j) => (j === i ? e.target.checked : w)),
                      )
                    }
                  />
                  {day} · {working[i] ? "Рабочий день" : "Выходной"}
                </label>
                <label htmlFor={scope + "-start-" + i}>Начало · {day}</label>
                <input
                  id={scope + "-start-" + i}
                  aria-label={"Начало · " + day}
                  name={"week." + i + ".startMinute"}
                  type="time"
                  disabled={!working[i]}
                  defaultValue={timeValue(days[i]?.startMinute ?? null)}
                />
                <label htmlFor={scope + "-end-" + i}>Конец · {day}</label>
                <input
                  id={scope + "-end-" + i}
                  aria-label={"Конец · " + day}
                  name={"week." + i + ".endMinute"}
                  type="time"
                  disabled={!working[i]}
                  defaultValue={timeValue(days[i]?.endMinute ?? null)}
                />
              </div>
            ))}
          </div>
        </ScheduleForm>
      </section>
      <section className="crm-section">
        <h2>Исключения по датам</h2>
        <p className="crm-hint">
          Особые рабочие часы заменяют обычный график на выбранную дату.
          Выходной блокирует день; частичная недоступность исключает указанный
          период.
        </p>
        {dated.length ? (
          <ul className="availability-exceptions">
            {dated.map((r) => (
              <li key={r.id}>
                <div>
                  <strong>{r.date}</strong> ·{" "}
                  {r.kind === "AVAILABLE" ? "Особые часы" : "Недоступен"} ·{" "}
                  {r.startMinute === null
                    ? "Весь день"
                    : minuteLabel(r.startMinute) +
                      "–" +
                      minuteLabel(r.endMinute!)}
                  {r.reason && <p>{r.reason}</p>}
                </div>
                <ScheduleForm
                  command="availability-remove"
                  button="Убрать исключение"
                  payload={() => ({ id, date: r.date })}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="crm-hint">Исключений пока нет.</p>
        )}
        <details>
          <summary>＋ Добавить / заменить исключение</summary>
          <ScheduleForm
            command="availability-date"
            button="Сохранить исключение"
            payload={(f) => ({
              id,
              date: text(f, "date"),
              kind: exceptionKind,
              startMinute:
                exceptionKind === "UNAVAILABLE" && allDay
                  ? null
                  : timeMinute(text(f, "startMinute")),
              endMinute:
                exceptionKind === "UNAVAILABLE" && allDay
                  ? null
                  : timeMinute(text(f, "endMinute"), true),
              reason: optional(f, "reason"),
            })}
          >
            <div className="crm-fields-grid">
              <Field name="date" label="Дата исключения" type="date" required />
              <label className="crm-field">
                Тип исключения
                <select
                  value={exceptionKind}
                  onChange={(e) =>
                    setExceptionKind(e.target.value as typeof exceptionKind)
                  }
                >
                  <option value="UNAVAILABLE">Выходной / недоступен</option>
                  <option value="AVAILABLE">Особые рабочие часы</option>
                </select>
              </label>
              {(exceptionKind === "AVAILABLE" || !allDay) && (
                <>
                  <Field
                    name="startMinute"
                    label="Начало периода"
                    type="time"
                    required
                  />
                  <Field
                    name="endMinute"
                    label="Конец периода"
                    type="time"
                    required
                  />
                </>
              )}
              <Field name="reason" label="Причина / заметка" type="textarea" />
            </div>
            {exceptionKind === "UNAVAILABLE" && (
              <label className="crm-check">
                <input
                  type="checkbox"
                  checked={allDay}
                  onChange={(e) => setAllDay(e.target.checked)}
                />
                Весь день
              </label>
            )}
          </ScheduleForm>
        </details>
      </section>
    </>
  );
}
