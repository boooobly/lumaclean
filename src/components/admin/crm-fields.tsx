"use client";
import { useId, useState } from "react";
import { Field, CrmForm } from "./crm-form";
import {
  channelLabels,
  extraLabels,
  serviceLabels,
  soilLabels,
} from "@/lib/domain/crm-types";
import {
  calculatePrice,
  extrasPrices,
  formatRsd,
  type ServiceId,
} from "@/lib/pricing";
import { quantityExtras } from "@/lib/domain/crm-pricing";
import { AddressAutocomplete } from "./address-autocomplete";
import { SlotSearch } from "./routing-workspace";
export function Options({
  labels,
  empty,
}: {
  labels: Record<string, string>;
  empty?: string;
}) {
  return (
    <>
      {empty && <option value="">{empty}</option>}
      {Object.entries(labels).map(([key, label]) => (
        <option value={key} key={key}>
          {label}
        </option>
      ))}
    </>
  );
}
export type ClientValues = {
  name?: string;
  phone?: string;
  telegram?: string | null;
  whatsapp?: string | null;
  viber?: string | null;
  preferredChannel?: string | null;
  notes?: string | null;
  individualTerms?: string | null;
  discountPercent?: number;
};
export function ClientFields({ value = {} }: { value?: ClientValues }) {
  return (
    <div className="crm-fields-grid">
      <Field name="name" label="Имя клиента" value={value.name} required />
      <Field
        name="phone"
        label="Телефон"
        value={value.phone}
        type="tel"
        required
      />
      <Field name="telegram" label="Telegram" value={value.telegram} />
      <Field name="whatsapp" label="WhatsApp" value={value.whatsapp} />
      <Field name="viber" label="Viber" value={value.viber} />
      <Field
        name="preferredChannel"
        label="Предпочитаемый канал"
        value={value.preferredChannel}
      >
        <Options labels={channelLabels} empty="Не указан" />
      </Field>
      <Field
        name="discountPercent"
        label="Индивидуальная скидка, %"
        value={value.discountPercent ?? 0}
        type="number"
        min={0}
        max={100}
        step={0.01}
      />
      <Field
        name="individualTerms"
        label="Индивидуальные условия"
        value={value.individualTerms}
        type="textarea"
      />
      <Field
        name="notes"
        label="Внутренние заметки"
        value={value.notes}
        type="textarea"
      />
    </div>
  );
}
export type AddressValues = {
  label?: string | null;
  fullAddress?: string;
  apartment?: string | null;
  floor?: string | null;
  intercom?: string | null;
  comment?: string | null;
  latitude?: unknown;
  longitude?: unknown;
};
export function AddressFields({ value = {} }: { value?: AddressValues }) {
  return (
    <div className="crm-fields-grid">
      <Field name="label" label="Название адреса" value={value.label} />
      <AddressAutocomplete
        value={value.fullAddress}
        confirmed={value.latitude != null && value.longitude != null}
        required
      />
      <Field name="apartment" label="Квартира" value={value.apartment} />
      <Field name="floor" label="Этаж" value={value.floor} />
      <Field name="intercom" label="Домофон" value={value.intercom} />
      <Field
        name="addressComment"
        label="Комментарий к адресу"
        value={value.comment}
        type="textarea"
      />
    </div>
  );
}
export type ClientOption = {
  id: string;
  name: string;
  phone: string;
  discountPercent: number;
  addresses: { id: string; label: string | null; fullAddress: string }[];
};
export function ClientPicker({
  initial,
  onSelect,
}: {
  initial?: ClientOption;
  onSelect?: (client: ClientOption | null) => void;
}) {
  const [q, setQ] = useState(""),
    [rows, setRows] = useState<ClientOption[]>(initial ? [initial] : []),
    [selected, setSelected] = useState<ClientOption | null>(initial ?? null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const id = useId();
  async function search() {
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`/api/admin/clients?q=${encodeURIComponent(q)}`);
      const data = await r.json();
      if (!r.ok) throw new Error();
      setRows(data.rows);
    } catch {
      setError("Поиск временно недоступен");
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="crm-picker">
      <label htmlFor={id}>Найти клиента по имени или телефону</label>
      <div className="crm-search-line">
        <input
          id={id}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void search();
            }
          }}
          placeholder="Имя, телефон, мессенджер"
        />
        <button
          type="button"
          className="crm-button crm-button-secondary"
          disabled={loading}
          onClick={search}
        >
          {loading ? "Ищем…" : "Найти"}
        </button>
      </div>
      <label htmlFor={`${id}-select`}>Выбранный клиент</label>
      <select
        id={`${id}-select`}
        name="clientId"
        value={selected?.id ?? ""}
        onChange={(e) => {
          const value = rows.find((r) => r.id === e.target.value) ?? null;
          setSelected(value);
          onSelect?.(value);
        }}
      >
        <option value="">Новый клиент / не выбран</option>
        {rows.map((row) => (
          <option key={row.id} value={row.id}>
            {row.name} · {row.phone}
          </option>
        ))}
      </select>
      {!loading && q && rows.length === 0 && <p>Ничего не найдено</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
export type OrderValues = {
  service?: ServiceId;
  area?: number;
  soilLevel?: string;
  urgent?: boolean;
  extras?: { code: keyof typeof extrasPrices; quantity: number }[];
  requiredCleaners?: number;
  manualDurationMinutes?: number | null;
  scheduleMode?: "FIXED" | "FLEXIBLE";
  scheduledStart?: string;
  windowFrom?: string;
  windowTo?: string;
  finalPrice?: number | null;
  priceChangeReason?: string | null;
  clientComment?: string | null;
  internalComment?: string | null;
  basePrice?: number;
  discountPercent?: number;
};
export function OrderForm({
  id,
  leadId,
  initialClient,
  addressId,
  clientValues,
  value = {},
}: {
  id?: string;
  leadId?: string;
  addressId?: string;
  initialClient?: ClientOption;
  clientValues?: ClientValues;
  value?: OrderValues;
}) {
  const [selected, setSelected] = useState(initialClient ?? null),
    [newAddress, setNewAddress] = useState(!initialClient?.addresses.length),
    [service, setService] = useState<ServiceId>(value.service ?? "regular"),
    [area, setArea] = useState(value.area ?? 55),
    [urgent, setUrgent] = useState(value.urgent ?? false),
    [scheduleMode, setScheduleMode] = useState(value.scheduleMode ?? "FIXED"),
    [discount, setDiscount] = useState(
      initialClient?.discountPercent ?? value.discountPercent ?? 0,
    );
  const [extras, setExtras] = useState(
    Object.fromEntries(
      Object.keys(extrasPrices).map((code) => [
        code,
        value.extras?.find((e) => e.code === code)?.quantity ?? 0,
      ]),
    ) as Record<keyof typeof extrasPrices, number>,
  );
  const sameScope =
    Boolean(id) &&
    service === value.service &&
    area === value.area &&
    urgent === Boolean(value.urgent) &&
    Object.keys(extras).every(
      (code) =>
        extras[code as keyof typeof extrasPrices] ===
        (value.extras?.find((e) => e.code === code)?.quantity ?? 0),
    );
  const calculated = calculatePrice(
    service,
    area,
    Object.entries(extras).map(([code, quantity]) => ({
      code: code as keyof typeof extrasPrices,
      quantity,
    })),
    urgent,
  );
  const total = sameScope
    ? (value.basePrice ?? calculated.total)
    : calculated.total;
  const suggested = Math.round(total * (1 - discount / 100) * 100) / 100;
  return (
    <CrmForm
      command={id ? "order-update" : "order-create"}
      id={id}
      leadId={leadId}
      button={id ? "Сохранить заказ" : "Создать заказ"}
      redirectTo="/admin/orders/[id]"
    >
      {id && initialClient && (
        <section className="crm-form-section">
          <h2>Адрес клиента · {initialClient.name}</h2>
          <Field name="addressId" label="Адрес уборки" value={addressId}>
            <>
              {initialClient.addresses.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label ? `${a.label} · ` : ""}
                  {a.fullAddress}
                </option>
              ))}
            </>
          </Field>
        </section>
      )}
      {!id && (
        <>
          <section className="crm-form-section">
            <h2>01 · Клиент</h2>
            <ClientPicker
              initial={initialClient}
              onSelect={(c) => {
                setSelected(c);
                setNewAddress(!c?.addresses.length);
                setDiscount(c?.discountPercent ?? 0);
              }}
            />
            {!selected && (
              <div
                onChange={(e) => {
                  const target = e.target as HTMLInputElement;
                  if (target.name === "discountPercent")
                    setDiscount(Number(target.value));
                }}
              >
                <ClientFields value={clientValues} />
              </div>
            )}
          </section>
          <section className="crm-form-section">
            <h2>02 · Адрес</h2>
            {selected && selected.addresses.length > 0 && (
              <>
                <label className="crm-check">
                  <input
                    type="checkbox"
                    checked={newAddress}
                    onChange={(e) => setNewAddress(e.target.checked)}
                  />
                  Добавить новый адрес
                </label>
                {!newAddress && (
                  <Field
                    name="addressId"
                    label="Адрес клиента"
                    value={selected.addresses[0]?.id}
                  >
                    <>
                      {selected.addresses.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.label ? `${a.label} · ` : ""}
                          {a.fullAddress}
                        </option>
                      ))}
                    </>
                  </Field>
                )}
              </>
            )}
            {newAddress && <AddressFields />}
          </section>
        </>
      )}
      <section className="crm-form-section">
        <h2>{id ? "Услуга и объём" : "03 · Услуга и объём"}</h2>
        <div
          className="crm-fields-grid"
          onChange={(e) => {
            const t = e.target as HTMLInputElement;
            if (t.name === "service") setService(t.value as ServiceId);
            if (t.name === "area") setArea(Number(t.value));
          }}
        >
          <Field name="service" label="Услуга" value={service}>
            <Options labels={serviceLabels} />
          </Field>
          <Field
            name="area"
            label="Площадь, м²"
            value={area}
            type="number"
            min={1}
            max={10000}
            step={0.01}
            required
          />
          <Field
            name="soilLevel"
            label="Загрязнение"
            value={value.soilLevel ?? "NORMAL"}
          >
            <Options labels={soilLabels} />
          </Field>
          <Field
            name="requiredCleaners"
            label="Необходимое число клинеров"
            value={value.requiredCleaners ?? 1}
            type="number"
            min={1}
            max={30}
            step={1}
          />
          <Field
            name="manualDurationMinutes"
            label="Ручная длительность, минут"
            value={value.manualDurationMinutes}
            type="number"
            min={1}
            max={1440}
            step={1}
          />
          <p className="crm-hint">
            Расчётная длительность: не рассчитано. Ручное значение хранится
            отдельно.
          </p>
        </div>
        <div className="crm-extras">
          {Object.entries(extraLabels).map(([code, label]) => (
            <div
              key={code}
              onChange={(e) => {
                const t = e.target as HTMLInputElement;
                setExtras({ ...extras, [code]: Number(t.value) });
              }}
            >
              <Field
                name={`extra-${code}`}
                label={`${label} · ${formatRsd(extrasPrices[code as keyof typeof extrasPrices], "ru")}`}
                type="number"
                min={0}
                max={
                  (quantityExtras as readonly string[]).includes(code) ? 100 : 1
                }
                step={1}
                value={extras[code as keyof typeof extrasPrices]}
              />
            </div>
          ))}
        </div>
        <label className="crm-check">
          <input
            type="checkbox"
            name="urgent"
            checked={urgent}
            onChange={(e) => setUrgent(e.target.checked)}
          />
          Срочная уборка · +20%
        </label>
      </section>
      <section className="crm-form-section">
        <h2>Время · Europe/Belgrade</h2>
        <div
          className="crm-fields-grid"
          onChange={(e) => {
            const t = e.target as HTMLInputElement;
            if (t.name === "scheduleMode")
              setScheduleMode(t.value as "FIXED" | "FLEXIBLE");
          }}
        >
          <Field name="scheduleMode" label="Режим времени" value={scheduleMode}>
            <option value="FIXED">Точное время</option>
            <option value="FLEXIBLE">Гибкое окно</option>
          </Field>
          {scheduleMode === "FIXED" ? (
            <Field
              name="scheduledStart"
              label="Дата и время начала"
              type="datetime-local"
              value={value.scheduledStart}
              required
            />
          ) : (
            <>
              {!id && (
                <input type="hidden" name="scheduledStart" defaultValue="" />
              )}
              <Field
                name="windowFrom"
                label="Начало окна"
                type="datetime-local"
                value={value.windowFrom}
                required
              />
              <Field
                name="windowTo"
                label="Конец окна"
                type="datetime-local"
                value={value.windowTo}
                required
              />
            </>
          )}
        </div>
      </section>
      <section className="crm-form-section">
        <h2>Цена и договорённости</h2>
        {!id && (
          <>
            <input type="hidden" name="suggestedCleanerIds" defaultValue="[]" />
            <SlotSearch />
          </>
        )}
        <dl className="crm-price-preview">
          <div>
            <dt>
              Расчётная стоимость{sameScope ? " · сохранённый прайс" : ""}
            </dt>
            <dd>{formatRsd(total, "ru")}</dd>
          </div>
          <div>
            <dt>Скидка клиента</dt>
            <dd>{discount}%</dd>
          </div>
          <div>
            <dt>После скидки</dt>
            <dd>{formatRsd(suggested, "ru")}</dd>
          </div>
        </dl>
        <p className="crm-hint">
          Пустая финальная цена — стоимость после скидки. Для другого значения
          нужна причина.
        </p>
        <div className="crm-fields-grid">
          <Field
            name="finalPrice"
            label="Финальная цена, RSD"
            value={value.finalPrice}
            type="number"
            min={0}
            step={0.01}
          />
          <Field
            name="priceChangeReason"
            label="Причина изменения цены"
            value={value.priceChangeReason}
            type="textarea"
          />
          <Field
            name="clientComment"
            label="Комментарий клиента"
            value={value.clientComment}
            type="textarea"
          />
          <Field
            name="internalComment"
            label="Внутренний комментарий"
            value={value.internalComment}
            type="textarea"
          />
        </div>
      </section>
    </CrmForm>
  );
}
