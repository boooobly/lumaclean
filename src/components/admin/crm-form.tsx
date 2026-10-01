"use client";
import {
  createContext,
  useContext,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { CommandName } from "@/lib/validation/crm";
import { extrasPrices } from "@/lib/pricing";
import type { SchedulingIssue } from "@/lib/domain/scheduling-types";
type Errors = { field: string; message: string }[];
export const FormContext = createContext<{ id: string; errors: Errors }>({
  id: "crm",
  errors: [],
});
export function Field({
  name,
  label,
  value,
  type = "text",
  required = false,
  children,
  min,
  max,
  step,
  rows = 3,
  readOnly = false,
}: {
  name: string;
  label: string;
  value?: string | number | null;
  type?: string;
  required?: boolean;
  children?: ReactNode;
  min?: number;
  max?: number;
  step?: number;
  rows?: number;
  readOnly?: boolean;
}) {
  const form = useContext(FormContext),
    id = `${form.id}-${name}`,
    errors = form.errors.filter((e) => e.field === name);
  const props = {
    id,
    name,
    defaultValue: value ?? "",
    required,
    "aria-invalid": errors.length > 0,
    "aria-describedby": errors.length ? `${id}-error` : undefined,
  };
  return (
    <div className="crm-field">
      <label htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {children ? (
        <select {...props}>{children}</select>
      ) : type === "textarea" ? (
        <textarea {...props} rows={rows} />
      ) : (
        <input
          {...props}
          type={type}
          min={min}
          max={max}
          step={step}
          readOnly={readOnly}
        />
      )}
      {errors.length > 0 && (
        <small id={`${id}-error`} className="crm-field-error">
          {errors.map((e) => e.message).join(". ")}
        </small>
      )}
    </div>
  );
}
const str = (f: FormData, name: string) => String(f.get(name) ?? "").trim();
const optional = (f: FormData, name: string) => str(f, name) || null;
const num = (f: FormData, name: string) =>
  optional(f, name) === null ? null : Number(str(f, name));
const client = (f: FormData) => ({
  name: str(f, "name"),
  phone: str(f, "phone"),
  telegram: optional(f, "telegram"),
  whatsapp: optional(f, "whatsapp"),
  viber: optional(f, "viber"),
  preferredChannel: optional(f, "preferredChannel"),
  notes: optional(f, "notes"),
  individualTerms: optional(f, "individualTerms"),
  discountPercent: num(f, "discountPercent") ?? 0,
});
const address = (f: FormData) => ({
  label: optional(f, "label"),
  fullAddress: str(f, "fullAddress"),
  apartment: optional(f, "apartment"),
  floor: optional(f, "floor"),
  intercom: optional(f, "intercom"),
  comment: optional(f, "addressComment"),
  locationProof: optional(f, "locationProof"),
});
function order(f: FormData) {
  return {
    service: str(f, "service"),
    area: num(f, "area"),
    soilLevel: str(f, "soilLevel"),
    urgent: f.get("urgent") === "on",
    requiredCleaners: num(f, "requiredCleaners"),
    manualDurationMinutes: num(f, "manualDurationMinutes"),
    durationOverrideReason: optional(f, "durationOverrideReason"),
    scheduleMode: str(f, "scheduleMode"),
    scheduledStart: optional(f, "scheduledStart"),
    windowFrom: optional(f, "windowFrom"),
    windowTo: optional(f, "windowTo"),
    finalPrice: num(f, "finalPrice"),
    priceChangeReason: optional(f, "priceChangeReason"),
    clientComment: optional(f, "clientComment"),
    internalComment: optional(f, "internalComment"),
    extras: Object.keys(extrasPrices).map((code) => ({
      code,
      quantity: Number(f.get(`extra-${code}`) ?? 0),
    })),
  };
}
export function CrmForm({
  command,
  id,
  clientId,
  leadId,
  children,
  button = "Сохранить",
  redirectTo,
  refresh = true,
  compact = false,
  active,
}: {
  command: CommandName;
  id?: string;
  clientId?: string;
  leadId?: string;
  children?: ReactNode;
  button?: string;
  redirectTo?: string;
  refresh?: boolean;
  compact?: boolean;
  active?: boolean;
}) {
  const router = useRouter(),
    formId = useId(),
    busy = useRef(false),
    requestId = useRef<string | null>(null);
  const [pending, setPending] = useState(false),
    [errors, setErrors] = useState<Errors>([]),
    [message, setMessage] = useState(""),
    [ok, setOk] = useState(false);
  const [matches, setMatches] = useState<
      { id: string; name: string; phone: string }[]
    >([]),
    [allowDuplicate, setAllowDuplicate] = useState(false);
  const [issues, setIssues] = useState<SchedulingIssue[]>([]),
    [acknowledged, setAcknowledged] = useState(false),
    [overrideReason, setOverrideReason] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const f = new FormData(event.currentTarget);
    let payload: unknown;
    switch (command) {
      case "lead-create":
        payload = {
          name: str(f, "name"),
          phone: str(f, "phone"),
          service: str(f, "service"),
          area: num(f, "area"),
          locale: str(f, "locale"),
          channel: str(f, "channel"),
          comment: optional(f, "comment"),
          internalNote: optional(f, "internalNote"),
        };
        break;
      case "lead-status":
      case "order-status":
        payload = {
          id,
          status: str(f, "status"),
          reason: optional(f, "reason"),
        };
        break;
      case "lead-note":
        payload = { id, note: optional(f, "note") };
        break;
      case "lead-link":
        payload = { id, clientId: str(f, "clientId") };
        break;
      case "client-create":
        payload = { client: client(f), leadId: leadId ?? null, allowDuplicate };
        break;
      case "client-update":
        payload = { id, client: client(f) };
        break;
      case "address-create":
        payload = { clientId, address: address(f) };
        break;
      case "address-update":
        payload = { id, clientId, address: address(f) };
        break;
      case "address-active":
        payload = { id, clientId, active };
        break;
      case "order-create":
        requestId.current ??= crypto.randomUUID();
        payload = {
          requestId: requestId.current,
          leadId: leadId ?? null,
          clientId: optional(f, "clientId"),
          newClient: optional(f, "clientId") ? null : client(f),
          addressId: optional(f, "addressId"),
          newAddress: optional(f, "addressId") ? null : address(f),
          allowDuplicate,
          order: order(f),
          suggestedCleanerIds: JSON.parse(
            str(f, "suggestedCleanerIds") || "[]",
          ),
        };
        break;
      case "order-update":
        payload = {
          id,
          addressId: optional(f, "addressId") ?? undefined,
          order: order(f),
          acknowledged: acknowledged
            ? issues.filter((i) => i.severity === "WARNING").map((i) => i.key)
            : [],
          overrideReason: acknowledged ? overrideReason : null,
        };
        break;
    }
    busy.current = true;
    setPending(true);
    setErrors([]);
    setMessage("");
    setOk(false);
    try {
      const response = await fetch(`/api/admin/crm/${command}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) {
        setIssues(result?.issues ?? []);
        setErrors(result?.errors ?? []);
        setMessage(
          result?.matches?.length
            ? ""
            : (result?.error ?? "Не удалось сохранить. Повторите попытку."),
        );
        setMatches(result?.matches ?? []);
        if (response.status === 401) router.push("/admin/login");
        return;
      }
      setMatches([]);
      setIssues([]);
      setAcknowledged(false);
      setOk(true);
      setMessage("Сохранено");
      if (redirectTo) router.push(redirectTo.replace("[id]", result.id));
      if (refresh) router.refresh();
    } catch {
      setMessage(
        "Связь прервалась. Данные формы сохранены — повторите отправку.",
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <FormContext.Provider value={{ id: formId, errors }}>
      <form
        onSubmit={submit}
        onChange={(e) => {
          const field = e.target.getAttribute("name");
          if (field !== "scheduleAcknowledged" && field !== "overrideReason") {
            setAcknowledged(false);
            setIssues([]);
          }
          if (field === "phone" || field === "clientId") {
            setMatches([]);
            setAllowDuplicate(false);
          }
        }}
        className={compact ? "crm-form crm-form-compact" : "crm-form"}
        noValidate
        aria-busy={pending}
      >
        <fieldset disabled={pending} className="crm-form-fields">
          {children}
        </fieldset>
        {issues.length > 0 && (
          <aside className="schedule-issues" role="alert">
            <strong>Проверка планирования</strong>
            <ul>
              {issues.map((i) => (
                <li key={i.key}>
                  <b>{i.severity === "ERROR" ? "Конфликт" : "Внимание"}</b> ·{" "}
                  {i.message}
                </li>
              ))}
            </ul>
            {!issues.some((i) => i.severity === "ERROR") && (
              <>
                <label className="crm-check">
                  <input
                    name="scheduleAcknowledged"
                    type="checkbox"
                    checked={acknowledged}
                    onChange={(e) => setAcknowledged(e.target.checked)}
                  />
                  Подтверждаю перечисленные предупреждения
                </label>
                <label htmlFor={formId + "-overrideReason"}>
                  Причина подтверждения
                </label>
                <textarea
                  id={formId + "-overrideReason"}
                  name="overrideReason"
                  maxLength={1000}
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                />
              </>
            )}
          </aside>
        )}
        {matches.length > 0 && (
          <aside className="crm-duplicate" role="alert">
            <strong>Возможно, клиент уже существует</strong>
            <ul>
              {matches.map((m) => (
                <li key={m.id}>
                  <Link href={`/admin/clients/${m.id}`}>
                    {m.name} · {m.phone}
                  </Link>
                  {leadId && command === "client-create" && (
                    <Link
                      className="admin-text-link"
                      href={`/admin/leads/${leadId}?clientId=${m.id}`}
                    >
                      Использовать существующего →
                    </Link>
                  )}
                </li>
              ))}
            </ul>
            <p>
              Для заказа выберите клиента в поиске выше. Если это другой человек
              с общим телефоном, подтвердите создание.
            </p>
            <label className="crm-check">
              <input
                type="checkbox"
                checked={allowDuplicate}
                onChange={(e) => setAllowDuplicate(e.target.checked)}
              />
              Всё равно создать нового клиента
            </label>
          </aside>
        )}
        {message && (
          <p
            className={ok ? "crm-success" : "crm-field-error"}
            role={ok ? "status" : "alert"}
          >
            {message}
          </p>
        )}
        <div className="crm-form-actions">
          <button className="crm-button" type="submit" disabled={pending}>
            {pending ? "Сохраняем…" : button}
          </button>
        </div>
      </form>
    </FormContext.Provider>
  );
}
