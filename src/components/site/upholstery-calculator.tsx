"use client";
import { useRef, useState } from "react";
import type { Locale } from "@/i18n/routing";
import {
  type calculateUpholstery,
  type UpholsteryRequest,
} from "@/lib/upholstery";
import { upholsteryUi } from "@/lib/upholstery-content";
import { serviceIds, formatRsd, type ServiceId } from "@/lib/pricing";
import { siteContent } from "@/lib/content";
import {
  FurnitureFields,
  newFurniture,
  type Furniture,
} from "./upholstery-fields";
type Quote = ReturnType<typeof calculateUpholstery>;
export function UpholsteryCalculator({ locale }: { locale: Locale }) {
  const c = upholsteryUi[locale],
    pending = useRef(false),
    submission = useRef<{ id: string; payload: string } | null>(null);
  const [items, setItems] = useState<Furniture[]>([newFurniture()]),
    [mode, setMode] = useState<UpholsteryRequest["mode"]>("STANDALONE"),
    [withCleaning, setWithCleaning] = useState(true),
    [service, setService] = useState<ServiceId>("regular"),
    [area, setArea] = useState(50),
    [date, setDate] = useState(""),
    [quote, setQuote] = useState<Quote | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [success, setSuccess] = useState(false);
  const request: UpholsteryRequest = {
    mode,
    items: items.map((i) =>
      i.type === "CORNER" ? { ...i, seats: i.seats ?? 3 } : i,
    ),
    urgent: false,
    ...(mode === "ADDON" && withCleaning
      ? { cleaning: { service, area } }
      : {}),
  };
  const changed = () => {
    setQuote(null);
    setSuccess(false);
  };
  async function calculate() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/upholstery", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            request,
            ...(date ? { requestedDate: date } : {}),
          }),
        }),
        d = await r.json();
      if (!r.ok || !d.ok) throw Error(c.error);
      setQuote(d.result);
    } catch (e) {
      setError(e instanceof Error ? e.message : c.error);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending.current || !quote) return;
    pending.current = true;
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget),
      payload = JSON.stringify({
        request,
        requestedDate: date || undefined,
        name: f.get("name"),
        phone: f.get("phone"),
        locale,
        consent: f.get("consent") === "on",
        comment: f.get("comment") || "",
      });
    if (!submission.current || submission.current.payload !== payload)
      submission.current = { id: crypto.randomUUID(), payload };
    try {
      const r = await fetch("/api/upholstery/lead", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...JSON.parse(payload),
            submissionId: submission.current.id,
          }),
        }),
        d = await r.json();
      if (!r.ok || !d.ok) throw Error(c.error);
      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : c.error);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="upholstery-calculator">
      <div onChange={changed}>
        <fieldset className="upholstery-mode">
          <legend>{c.service}</legend>
          <label>
            <input
              type="radio"
              name={`upholstery-mode-${locale}`}
              checked={mode === "STANDALONE"}
              onChange={() => setMode("STANDALONE")}
            />
            {c.standalone}
          </label>
          <label>
            <input
              type="radio"
              name={`upholstery-mode-${locale}`}
              checked={mode === "ADDON"}
              onChange={() => setMode("ADDON")}
            />
            {c.addon}
          </label>
        </fieldset>
        {mode === "ADDON" && (
          <>
            <label className="upholstery-check">
              <input
                type="checkbox"
                checked={withCleaning}
                onChange={(e) => setWithCleaning(e.target.checked)}
              />
              {c.includeCleaning}
            </label>
            {withCleaning && (
              <div className="upholstery-fields">
                <label>
                  {c.service}
                  <select
                    value={service}
                    onChange={(e) => setService(e.target.value as ServiceId)}
                  >
                    {serviceIds.map((s) => (
                      <option key={s} value={s}>
                        {siteContent[locale].pricing.serviceNames[s]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {c.area}
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={area}
                    onChange={(e) => setArea(Number(e.target.value))}
                  />
                </label>
              </div>
            )}
          </>
        )}
        <FurnitureFields
          locale={locale}
          items={items}
          onChange={(v) => {
            setItems(v);
            changed();
          }}
        />
        <label>
          {locale === "ru"
            ? "Желаемая дата"
            : locale === "en"
              ? "Preferred date"
              : "Željeni datum"}
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <button
          className="upholstery-cta"
          type="button"
          disabled={busy}
          onClick={() => void calculate()}
        >
          {c.quote}
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      {quote && (
        <section className="upholstery-receipt" aria-live="polite">
          <h3>{c.total}</h3>
          <ul>
            {quote.lines.map((l) => (
              <li key={l.index}>
                <span>
                  {c.types[l.type]} × {l.units} · {c.soils[l.soil]}
                </span>
                <strong>
                  {l.from ? c.from + " " : ""}
                  {formatRsd(l.amount, locale)}
                </strong>
              </li>
            ))}
            {quote.cleaningBase > 0 && (
              <li>
                <span>{c.cleaning}</span>
                <strong>{formatRsd(quote.cleaningBase, locale)}</strong>
              </li>
            )}
            {quote.minimumAdjustment > 0 && (
              <li>
                <span>{c.minimumAdjustment}</span>
                <strong>{formatRsd(quote.minimumAdjustment, locale)}</strong>
              </li>
            )}
            {quote.surcharge > 0 && (
              <li>
                <span>{c.surcharge}</span>
                <strong>{formatRsd(quote.surcharge, locale)}</strong>
              </li>
            )}
          </ul>
          <p className="upholstery-total">
            {quote.from ? c.from + " " : ""}
            {formatRsd(quote.total, locale)}
          </p>
          <p>{c.delivery}</p>
          <p>{c.review}</p>
          {quote.materialRejected ? (
            <p role="alert">{c.fabrics.UNSAFE}</p>
          ) : success ? (
            <p role="status">{c.success}</p>
          ) : (
            <form onSubmit={send}>
              <div className="upholstery-fields">
                <label>
                  {c.nameField}
                  <input
                    name="name"
                    required
                    minLength={2}
                    maxLength={100}
                    autoComplete="name"
                  />
                </label>
                <label>
                  {c.phone}
                  <input
                    name="phone"
                    type="tel"
                    required
                    minLength={6}
                    maxLength={40}
                    autoComplete="tel"
                  />
                </label>
                <label>
                  {c.notes}
                  <textarea name="comment" maxLength={1500} />
                </label>
              </div>
              <label className="upholstery-check">
                <input name="consent" type="checkbox" required />
                {c.consent} ·{" "}
                <a href={`/${locale}/privacy-policy`}>
                  {locale === "ru"
                    ? "Конфиденциальность"
                    : locale === "sr"
                      ? "Privatnost"
                      : "Privacy"}
                </a>
              </label>
              <button className="upholstery-cta" disabled={busy}>
                {c.send}
              </button>
            </form>
          )}
        </section>
      )}
    </div>
  );
}
