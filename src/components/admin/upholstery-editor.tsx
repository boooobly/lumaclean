"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { z } from "zod";
import type {
  upholsterySaveSchema,
  upholsterySettingsSchema,
} from "@/lib/services/upholstery-commands";
import { upholsteryUi } from "@/lib/upholstery-content";
import { upholsteryPriceKeys } from "@/lib/upholstery";
import {
  FurnitureFields,
  newFurniture,
} from "@/components/site/upholstery-fields";
import "@/components/site/upholstery.css";
type Input = z.infer<typeof upholsterySaveSchema>;
type Settings = z.infer<typeof upholsterySettingsSchema>;
type Client = {
  id: string;
  name: string;
  addresses: { id: string; fullAddress: string }[];
};
type Crew = { id: string; name: string };
async function post(action: string, payload: unknown) {
  const r = await fetch(`/api/admin/upholstery/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
    d = await r.json();
  if (!r.ok || !d.ok)
    throw Error(
      [
        d.error,
        ...(d.issues ?? []).map((i: { message: string }) => i.message),
        ...(d.errors ?? []).map((i: { message: string }) => i.message),
      ]
        .filter(Boolean)
        .join("\n"),
    );
  return d.result;
}
export function UpholsterySettingsEditor({ settings }: { settings: Settings }) {
  const [error, setError] = useState(""),
    [pending, setPending] = useState(false),
    router = useRouter();
  return (
    <form
      className="upholstery-admin"
      onSubmit={async (e) => {
        e.preventDefault();
        if (pending) return;
        setPending(true);
        setError("");
        const f = new FormData(e.currentTarget);
        try {
          await post("settings", {
            version: settings.version,
            catalog: Object.fromEntries(
              upholsteryPriceKeys.map((k) => [k, Number(f.get(k))]),
            ),
            extractorQuantity: Number(f.get("quantity")),
          });
          router.refresh();
          setError("Прайс сохранён. Исторические расчёты не изменены.");
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setPending(false);
        }
      }}
    >
      <p>
        Прайс общий для сайта, калькулятора, CRM и AI. Длительность пока
        согласуется владельцем для каждого заказа. Модель аппарата и средство не
        указаны.
      </p>
      <div className="upholstery-fields">
        {upholsteryPriceKeys.map((k) => (
          <label key={k}>
            {upholsteryUi.ru.catalogLabels[k]} · RSD
            <input
              name={k}
              type="number"
              min={1}
              max={100000}
              required
              defaultValue={settings.catalog[k]}
            />
          </label>
        ))}
        <label>
          Доступных экстракторов
          <input
            name="quantity"
            type="number"
            min={0}
            max={20}
            required
            defaultValue={settings.extractorQuantity}
          />
        </label>
      </div>
      <p role="status">{error}</p>
      <button className="crm-button" disabled={pending}>
        Сохранить прайс и количество аппаратов
      </button>
    </form>
  );
}
export function UpholsteryEditor({
  clients,
  crew,
  catalogVersion,
  extractorQuantity,
  initial,
}: {
  clients: Client[];
  crew: Crew[];
  catalogVersion: number;
  extractorQuantity: number;
  initial?: Partial<Input>;
}) {
  const router = useRouter(),
    inFlight = useRef(false),
    requestId = useRef<string | null>(null);
  const [v, setV] = useState<Omit<Input, "requestId">>({
    cleaningMinutes: null,
    clientId: clients[0]?.id ?? "",
    addressId: clients[0]?.addresses[0]?.id ?? "",
    catalogVersion,
    request: { mode: "STANDALONE", items: [newFurniture()], urgent: false },
    scheduledStart: "",
    cleanerIds: [],
    approve: false,
    reviewNote: "",
    photos: [],
    plannedMinutes: null,
    preparationMinutes: null,
    cleanupMinutes: null,
    transferMinutes: null,
    equipmentUnit: null,
    equipmentCleanerId: null,
    logisticsNote: "",
    patchTestConfirmed: false,
    finalPrice: null,
    priceReason: "",
    ...initial,
  });
  const [preview, setPreview] = useState<{
      quote: {
        lines: {
          type: keyof typeof upholsteryUi.ru.types;
          units: number;
          amount: number;
        }[];
        minimumAdjustment: number;
        surcharge: number;
        cleaningBaseline: number;
        suggestedTotal: number;
        agreedTotal: number;
      };
      issues: { message: string }[];
      pendingReview: boolean;
      scope: string;
    } | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const change = (update: Partial<typeof v>) => {
    setV((s) => ({ ...s, ...update }));
    setPreview(null);
    setError("");
    requestId.current = null;
  };
  async function action(name: "preview" | "save") {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    requestId.current ??= crypto.randomUUID();
    try {
      const result = await post(name, {
        ...v,
        requestId: requestId.current,
        request: {
          ...v.request,
          items: v.request.items.map((i) =>
            i.type === "CORNER" ? { ...i, seats: i.seats ?? 3 } : i,
          ),
        },
      });
      if (name === "preview") setPreview(result);
      else {
        router.push(`/admin/orders/${result.id}`);
        router.refresh();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  const numeric = (
    k:
      | "plannedMinutes"
      | "preparationMinutes"
      | "cleanupMinutes"
      | "transferMinutes"
      | "finalPrice",
    title: string,
  ) => (
    <label>
      {title}
      <input
        type="number"
        min={0}
        max={k === "finalPrice" ? 1000000 : 1440}
        value={v[k] ?? ""}
        onChange={(e) =>
          change({ [k]: e.target.value === "" ? null : Number(e.target.value) })
        }
      />
    </label>
  );
  return (
    <div className="upholstery-admin">
      <p>
        Сохраняется только этот черновик. Старые оплаты, расходы и выплаты не
        копируются. Подтверждение заказа и уведомление клиенту — отдельное
        действие после проверки.
      </p>
      <div className="upholstery-fields">
        <label>
          Клиент
          <select
            disabled={!!v.orderId}
            value={v.clientId}
            onChange={(e) =>
              change({
                clientId: e.target.value,
                addressId:
                  clients.find((c) => c.id === e.target.value)?.addresses[0]
                    ?.id ?? "",
              })
            }
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Адрес
          <select
            disabled={!!v.orderId}
            value={v.addressId}
            onChange={(e) => change({ addressId: e.target.value })}
          >
            {clients
              .find((c) => c.id === v.clientId)
              ?.addresses.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.fullAddress}
                </option>
              ))}
          </select>
        </label>
        <label>
          Дата и время · Europe/Belgrade
          <input
            type="datetime-local"
            value={v.scheduledStart}
            onChange={(e) => change({ scheduledStart: e.target.value })}
          />
        </label>
      </div>
      <p>
        {v.request.mode === "ADDON"
          ? v.orderId
            ? "Дополнение к существующей уборке. Согласованная цена основной уборки сохраняется."
            : "Уборка и химчистка в одном заказе. Доставка оборудования включена."
          : "Самостоятельная химчистка. Действует минимум отдельного выезда."}
      </p>
      {v.request.mode === "ADDON" && (
        <div className="upholstery-fields">
          {v.request.cleaning && (
            <label>
              Основная уборка · площадь м²
              <input
                type="number"
                value={v.request.cleaning.area}
                min={1}
                max={1000}
                onChange={(e) =>
                  change({
                    request: {
                      ...v.request,
                      cleaning: {
                        ...v.request.cleaning!,
                        area: Number(e.target.value),
                      },
                    },
                  })
                }
              />
            </label>
          )}
          <label>
            Длительность основной уборки · минут
            <input
              type="number"
              min={1}
              max={1440}
              value={v.cleaningMinutes ?? ""}
              onChange={(e) =>
                change({
                  cleaningMinutes: e.target.value
                    ? Number(e.target.value)
                    : null,
                })
              }
            />
          </label>
        </div>
      )}
      <FurnitureFields
        locale="ru"
        items={v.request.items}
        onChange={(items) => change({ request: { ...v.request, items } })}
      />
      <details open={v.approve}>
        <summary>Материал, фото и условия работы</summary>
        <label>
          Фотографии · HTTPS ссылки, по одной в строке
          <textarea
            value={v.photos.join("\n")}
            onChange={(e) =>
              change({ photos: e.target.value.split("\n").filter(Boolean) })
            }
          />
        </label>
        <label>
          Что проверено и согласовано: материал, фото, пятна и цена
          <textarea
            value={v.reviewNote}
            onChange={(e) => change({ reviewNote: e.target.value })}
          />
        </label>
        <label className="upholstery-check">
          <input
            type="checkbox"
            checked={v.approve}
            onChange={(e) => change({ approve: e.target.checked })}
          />
          Я проверил материал и согласовал цену. Длительность и логистика ниже
          подтверждены для этого выезда.
        </label>
        <label className="upholstery-check">
          <input
            type="checkbox"
            checked={v.patchTestConfirmed}
            onChange={(e) => change({ patchTestConfirmed: e.target.checked })}
          />
          На месте проведена проба стойкости окраски и совместимости ткани
          (необходимо перед началом обработки)
        </label>
      </details>
      <details open={v.approve}>
        <summary>Длительность, команда и экстрактор</summary>
        <p>
          Нормы не откалиброваны: поля не заполнены автоматически. Для
          дополнения время основной уборки включается отдельно.
        </p>
        <div className="upholstery-fields">
          {numeric("plannedMinutes", "Сама химчистка · минут")}
          {numeric("preparationMinutes", "Подготовка аппарата · минут")}
          {numeric("cleanupMinutes", "Очистка аппарата после работы · минут")}
          {numeric(
            "transferMinutes",
            "Резерв перевозки между заказами · минут",
          )}
          <label>
            Экстрактор
            <select
              value={v.equipmentUnit ?? ""}
              onChange={(e) =>
                change({
                  equipmentUnit: e.target.value ? Number(e.target.value) : null,
                })
              }
            >
              <option value="">Не назначен</option>
              {Array.from({ length: extractorQuantity }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  Экстрактор Kärcher · {i + 1}
                </option>
              ))}
            </select>
          </label>
          <label>
            Ответственный за аппарат
            <select
              value={v.equipmentCleanerId ?? ""}
              onChange={(e) =>
                change({ equipmentCleanerId: e.target.value || null })
              }
            >
              <option value="">Не назначен</option>
              {crew
                .filter((c) => v.cleanerIds.includes(c.id))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <fieldset>
          <legend>Команда</legend>
          {crew.map((c) => (
            <label className="upholstery-check" key={c.id}>
              <input
                type="checkbox"
                checked={v.cleanerIds.includes(c.id)}
                onChange={(e) =>
                  change({
                    cleanerIds: e.target.checked
                      ? [...v.cleanerIds, c.id]
                      : v.cleanerIds.filter((i) => i !== c.id),
                  })
                }
              />
              {c.name}
            </label>
          ))}
        </fieldset>
        <label>
          Где аппарат находится, кто забирает, как перевозит и возвращает
          <textarea
            value={v.logisticsNote}
            onChange={(e) => change({ logisticsNote: e.target.value })}
          />
        </label>
        <p>Для команды: взять экстрактор Kärcher.</p>
      </details>
      <details>
        <summary>Согласованная стоимость</summary>
        {numeric(
          "finalPrice",
          "Итоговая цена всего заказа · RSD (пусто — расчёт ниже)",
        )}
        <label>
          Причина индивидуальной цены
          <textarea
            value={v.priceReason}
            onChange={(e) => change({ priceReason: e.target.value })}
          />
        </label>
      </details>
      {error && (
        <p role="alert" style={{ whiteSpace: "pre-wrap" }}>
          {error}
        </p>
      )}
      {preview && (
        <section
          aria-label="Предварительный расчёт"
          className="upholstery-detail"
        >
          <h2>Предварительный расчёт</h2>
          <ul className="upholstery-quote-lines">
            {preview.quote.lines.map((l, i) => (
              <li key={i}>
                {upholsteryUi.ru.types[l.type]} × {l.units}
                <strong>{l.amount} RSD</strong>
              </li>
            ))}
          </ul>
          <p>
            Основная уборка: {preview.quote.cleaningBaseline} RSD · До минимума
            выезда: {preview.quote.minimumAdjustment} RSD · Срочность:{" "}
            {preview.quote.surcharge} RSD
          </p>
          <p>
            По расчёту: {preview.quote.suggestedTotal} RSD · Применить:{" "}
            <strong>{preview.quote.agreedTotal} RSD</strong>
          </p>
          {preview.pendingReview && (
            <p>
              Pending review: подтверждение записи заблокировано до согласования
              материала, цены, длительности и аппарата.
            </p>
          )}
          {preview.issues.map((i, n) => (
            <p role="alert" key={n}>
              {i.message}
            </p>
          ))}
          <p>{preview.scope}</p>
        </section>
      )}
      <div className="upholstery-admin-actions">
        <button
          type="button"
          className="crm-button"
          disabled={busy}
          onClick={() => void action("preview")}
        >
          Предварительный расчёт и проверка
        </button>
        <button
          type="button"
          className="crm-button"
          disabled={busy || !preview || preview.issues.length > 0}
          onClick={() => void action("save")}
        >
          Сохранить этот черновик
        </button>
      </div>
    </div>
  );
}
