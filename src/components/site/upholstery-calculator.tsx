"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import type { Locale } from "@/i18n/routing";
import { upholsteryUi } from "@/lib/upholstery-content";
import { upholsteryPremiumCopy } from "@/lib/upholstery-premium-content";
import { calculateUpholstery, furnitureTypes, upholsteryRequestSchema, type UpholsteryCatalog, type UpholsteryRequest } from "@/lib/upholstery";
import { formatRsd, serviceIds, type ServiceId } from "@/lib/pricing";
import { siteContent } from "@/lib/content";
import { isWebsitePhoneValid } from "@/lib/website-phone";
import { ArrowIcon } from "./arrow-icon";
import { UpholsteryPhotoButton } from "./upholstery-photo-button";

type Furniture = UpholsteryRequest["items"][number];
const freshItem = (type: Furniture["type"] = "SOFA3"): Furniture => ({ type, quantity: 1, ...(type === "CORNER" ? { seats: 4 } : {}), soil: "NORMAL", fabric: "UNKNOWN", size: "standard", material: "", notes: "" });
const selectionEvent = "lumaclean:upholstery-select";
const galleryTypes = ["SOFA3", "CORNER", "ARMCHAIR", "CHAIR", "SPOT"] as const;
const galleryImages = ["sofa", "corner", "armchair", "chair", "texture"];
const furnitureImage = (type: Furniture["type"]) => type === "SPOT" ? "/media/material-textile.webp" : `/media/upholstery/${({ SOFA3: "sofa", SOFA2: "sofa", CORNER: "corner", ARMCHAIR: "armchair", CHAIR: "chair" } as const)[type]}.webp`;

function SelectControl({ children, ...props }: ComponentProps<"select">) {
  return <span className="up-select"><select {...props}>{children}</select><svg className="up-select-chevron" width="14" height="8" viewBox="0 0 14 8" fill="none" aria-hidden="true" focusable="false"><path d="m1 1 6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></span>;
}

export function UpholsteryGallery({ locale, prices }: { locale: Locale; prices: number[] }) {
  const p = upholsteryPremiumCopy[locale], c = upholsteryUi[locale];
  const [announcement, setAnnouncement] = useState("");
  const [selected, setSelected] = useState<Furniture["type"] | null>(null);
  return <>
    <div className="up-gallery">
      {galleryTypes.map((type, i) => <button className={`up-gallery-item up-gallery-${i}${selected === type ? " is-selected" : ""}`} type="button" key={type} onClick={() => {
        const accepted = window.dispatchEvent(new CustomEvent(selectionEvent, { detail: type, cancelable: true }));
        if (!accepted) return;
        setSelected(type);
        setAnnouncement(`${p.galleryNames[i]} · ${p.selected}`);
        requestAnimationFrame(() => {
          const item = document.querySelector<HTMLElement>(".up-furniture[data-selected='true']");
          item?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
          item?.querySelector<HTMLSelectElement>(".up-type select")?.focus({ preventScroll: true });
        });
      }} aria-label={`${p.addLabel}: ${p.galleryNames[i]}`}>
        <span className="up-gallery-image"><Image src={i === 4 ? "/media/material-textile.webp" : `/media/upholstery/${galleryImages[i]}.webp`} alt={p.galleryAlts[i]} fill sizes={i === 0 || i === 1 ? "(max-width: 680px) 90vw, 46vw" : "(max-width: 680px) 44vw, 30vw"} /></span>
        <span className="up-gallery-caption"><span><strong>{p.galleryNames[i]}</strong><small>{p.galleryNotes[i]}</small></span><span className="up-gallery-price">{c.from} {formatRsd(prices[i], locale)}<span aria-hidden="true"><ArrowIcon direction="down-right" /></span></span></span>
      </button>)}
    </div>
    <p className="up-image-note">{p.illustration}</p>
    <span className="up-sr-only" role="status">{announcement}</span>
  </>;
}

export function UpholsteryCalculator({ locale, catalog, version }: { locale: Locale; catalog: UpholsteryCatalog; version: number }) {
  const c = upholsteryUi[locale], p = upholsteryPremiumCopy[locale];
  const [entries, setEntries] = useState([{ id: 0, value: freshItem() }]);
  const items = useMemo(() => entries.map(entry => entry.value), [entries]);
  const nextId = useRef(1);
  const [selectedId, setSelectedId] = useState(0);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const removing = useRef(false);
  const [mode, setMode] = useState<UpholsteryRequest["mode"]>("STANDALONE");
  const [service, setService] = useState<ServiceId>("regular");
  const [area, setArea] = useState(55);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error" | "validation" | "limited">("idle");
  const [reference, setReference] = useState("");
  const pristine = useRef(true), sending = useRef(false), completed = useRef(false);
  const submission = useRef<{ fields: string; id: string } | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const select = (event: Event) => {
      if (sending.current || completed.current || removing.current) { event.preventDefault(); return; }
      const type = (event as CustomEvent<Furniture["type"]>).detail;
      if (!furnitureTypes.includes(type)) return;
      const replace = pristine.current;
      pristine.current = false;
      const id = nextId.current++;
      setSelectedId(id);
      setEntries(old => replace ? [{ id, value: freshItem(type) }] : old.length < 20 ? [...old, { id, value: freshItem(type) }] : old);
    };
    window.addEventListener(selectionEvent, select);
    return () => window.removeEventListener(selectionEvent, select);
  }, []);

  const changeItem = (index: number, patch: Partial<Furniture>) => {
    pristine.current = false;
    setSelectedId(entries[index].id);
    setEntries(old => old.map((entry, i) => i === index ? { ...entry, value: { ...entry.value, ...patch } } : entry));
    if (status !== "success") setStatus("idle");
  };
  const calculation = useMemo(() => {
    const parsed = upholsteryRequestSchema.safeParse({ mode, items, urgent: false, ...(mode === "ADDON" ? { cleaning: { service, area } } : {}) });
    return parsed.success ? { request: parsed.data, quote: calculateUpholstery(parsed.data, catalog, version) } : null;
  }, [mode, items, service, area, catalog, version]);
  const mixed = items.some(i => i.type === "SPOT") && items.some(i => i.type !== "SPOT");
  const unsafe = items.some(i => i.fabric === "UNSAFE");
  const invalidName = name.trim().length < 2;
  const invalidPhone = !isWebsitePhoneValid(phone);
  const locked = status === "sending" || status === "success";

  function addItem() {
    pristine.current = false;
    const id = nextId.current++;
    setSelectedId(id);
    setEntries(old => [...old, { id, value: freshItem() }]);
  }

  async function removeItem(id: number) {
    if (removing.current || entries.length <= 1) return;
    removing.current = true;
    pristine.current = false;
    setRemovingId(id);
    const index = entries.findIndex(entry => entry.id === id);
    const nextFocus = entries[index + 1]?.id ?? entries[index - 1]?.id;
    const element = form.current?.querySelector<HTMLElement>(`[data-item-id="${id}"]`);
    if (element?.animate && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      try {
        const height = element.getBoundingClientRect().height;
        await element.animate([
          { height: `${height}px`, opacity: 1 },
          { height: "0px", opacity: 0, paddingTop: "0px", paddingBottom: "0px", marginBottom: "0px", borderWidth: "0px" },
        ], { duration: 240, easing: "cubic-bezier(.22,1,.36,1)", fill: "forwards" }).finished;
      } catch { /* Removing still works when the animation is interrupted. */ }
    }
    setEntries(old => old.filter(entry => entry.id !== id));
    setSelectedId(current => current === id ? nextFocus ?? 0 : current);
    setRemovingId(null);
    removing.current = false;
    requestAnimationFrame(() => form.current?.querySelector<HTMLSelectElement>(`[data-item-id="${nextFocus}"] .up-type select`)?.focus({ preventScroll: true }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current || completed.current || removing.current || unsafe) return;
    if (!calculation || invalidName || invalidPhone || !consent) {
      setStatus("validation");
      requestAnimationFrame(() => {
        const target = !calculation ? form.current?.querySelector<HTMLInputElement | HTMLSelectElement>("[aria-invalid='true'], input:invalid") : invalidName ? form.current?.elements.namedItem("name") : invalidPhone ? form.current?.elements.namedItem("phone") : form.current?.elements.namedItem("consent");
        if (target instanceof HTMLElement) target.focus();
        else statusRef.current?.focus();
      });
      return;
    }
    sending.current = true;
    setStatus("sending");
    try {
      const fields = JSON.stringify({ name: name.trim(), phone: phone.trim(), locale, consent: true, request: calculation.request });
      if (!submission.current || submission.current.fields !== fields) submission.current = { fields, id: crypto.randomUUID() };
      const response = await fetch("/api/upholstery/lead", { method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(20000), body: JSON.stringify({ ...JSON.parse(fields), submissionId: submission.current.id }) });
      const result = await response.json().catch(() => null);
      if (response.ok && result?.ok === true) {
        completed.current = true;
        setReference(typeof result.result?.reference === "string" ? result.result.reference : "");
        setStatus("success");
      } else setStatus(response.status === 429 ? "limited" : response.status === 400 ? "validation" : "error");
    } catch { setStatus("error"); }
    finally {
      sending.current = false;
      requestAnimationFrame(() => statusRef.current?.focus());
    }
  }

  return <form ref={form} className="up-calculator" onSubmit={submit} noValidate aria-label={c.estimate} aria-busy={status === "sending"}>
    <fieldset disabled={locked} className="up-calc-controls">
      <legend className="up-sr-only">{p.furnitureStep}</legend>
      <div className="up-form-heading"><span>01</span><h3>{p.furnitureStep}</h3></div>
      {mixed && <p className="up-form-note">{p.objectNote}</p>}
      {entries.map(({ id, value: item }, i) => <fieldset key={id} className={`up-furniture${removingId === id ? " is-removing" : ""}`} data-item-id={id} data-selected={selectedId === id}>
        <legend className="up-sr-only">{c.item} {String(i + 1).padStart(2, "0")}</legend>
        <div className="up-item-heading"><div className="up-item-identity"><span className="up-item-thumb"><Image src={furnitureImage(item.type)} alt="" fill sizes="64px" /></span><div><span className="up-item-number">{c.item} {String(i + 1).padStart(2, "0")}</span><h4>{c.types[item.type]}</h4></div></div>{items.length > 1 && <button type="button" className="up-remove" disabled={removingId !== null} aria-label={`${c.remove} · ${c.item} ${i + 1}`} onClick={() => void removeItem(id)}><svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg></button>}</div>
        <div className="up-item-top">
          <label className="up-type"><span>{c.item}</span><SelectControl id={`up-furniture-${i}`} value={item.type} onChange={e => changeItem(i, { type: e.target.value as Furniture["type"], ...(e.target.value === "CORNER" ? { seats: item.seats ?? 4 } : {}) })}>{furnitureTypes.map(t => <option value={t} key={t}>{c.types[t]}</option>)}</SelectControl></label>
          <div className="up-counter"><label htmlFor={`up-quantity-${i}`}>{c.quantity}</label><div><button type="button" aria-label={`${c.quantity} − · ${c.item} ${i + 1}`} disabled={item.quantity <= 1} onClick={() => changeItem(i, { quantity: Math.max(1, item.quantity - 1) })}>−</button><input id={`up-quantity-${i}`} type="number" min={1} max={30} step={1} value={item.quantity || ""} aria-invalid={item.quantity < 1 || item.quantity > 30 || !Number.isInteger(item.quantity)} onChange={e => changeItem(i, { quantity: Number(e.target.value) })} /><button type="button" aria-label={`${c.quantity} + · ${c.item} ${i + 1}`} disabled={item.quantity >= 30} onClick={() => changeItem(i, { quantity: Math.min(30, item.quantity + 1) })}>+</button></div></div>
        </div>
        <div className="up-field-grid">
          {item.type === "CORNER" && <label><span>{c.seats}</span><input type="number" min={2} max={20} value={item.seats || ""} aria-invalid={!item.seats || item.seats < 2 || item.seats > 20 || !Number.isInteger(item.seats)} onChange={e => changeItem(i, { seats: Number(e.target.value) })} /></label>}
          <label><span>{c.soil}</span><SelectControl value={item.soil} onChange={e => changeItem(i, { soil: e.target.value as Furniture["soil"] })}>{Object.entries(c.soils).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</SelectControl></label>
          <label className="up-fabric"><span>{c.fabric}</span><SelectControl value={item.fabric} onChange={e => changeItem(i, { fabric: e.target.value as Furniture["fabric"] })}>{Object.entries(p.fabricChoices).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</SelectControl></label>
        </div>
        {mixed && <label className="up-object-label"><span>{p.objectLabel}</span><input value={item.objectRef ?? ""} maxLength={100} required aria-invalid={!item.objectRef?.trim() || (item.type === "SPOT" && items.some(other => other.type !== "SPOT" && other.objectRef === item.objectRef))} placeholder={p.objectHint} onChange={e => changeItem(i, { objectRef: e.target.value })} /></label>}
        {item.fabric === "UNKNOWN" && <p className="up-form-note">{p.unknown}</p>}
        {item.fabric === "UNSAFE" && <p className="up-warning" role="status">{p.unsafe}</p>}
        {item.soil === "HEAVY" && <p className="up-warning" role="status">{p.heavy}</p>}
        <details className="up-item-details"><summary>{p.details}<span aria-hidden="true">+</span></summary><div className="up-field-grid"><label><span>{c.material}</span><input value={item.material} maxLength={160} placeholder={p.materialHint} onChange={e => changeItem(i, { material: e.target.value })} /></label><label><span>{p.size}</span><input value={item.size === "standard" ? "" : item.size} maxLength={100} placeholder={p.sizeHint} onChange={e => changeItem(i, { size: e.target.value.trim() ? e.target.value : "standard" })} /></label><label className="up-full"><span>{c.notes}</span><textarea rows={2} value={item.notes} maxLength={500} placeholder={p.noteHint} onChange={e => changeItem(i, { notes: e.target.value })} /></label></div></details>
      </fieldset>)}
      <button type="button" className="up-add" disabled={items.length >= 20 || removingId !== null} onClick={addItem}><span aria-hidden="true">+</span>{c.add}<ArrowIcon direction="down-right" /></button>
      <div className="up-form-heading"><span>02</span><h3>{p.visitStep}</h3></div>
      <div className="up-modes" role="group" aria-label={p.visitStep}>{(["STANDALONE", "ADDON"] as const).map(value => <label className={mode === value ? "is-selected" : ""} key={value}><input type="radio" name="mode" value={value} checked={mode === value} onChange={() => setMode(value)} /><span>{value === "STANDALONE" ? c.standalone : c.addon}<small>{value === "STANDALONE" ? p.visitOnlyHint : p.visitAddonHint}</small></span></label>)}</div>
      {mode === "ADDON" && <div className="up-field-grid up-cleaning"><label><span>{c.service}</span><SelectControl value={service} onChange={e => setService(e.target.value as ServiceId)}>{serviceIds.map(key => <option value={key} key={key}>{siteContent[locale].pricing.serviceNames[key]}</option>)}</SelectControl></label><label><span>{c.area}</span><input type="number" min={1} max={1000} value={area || ""} aria-invalid={area < 1 || area > 1000} onChange={e => setArea(Number(e.target.value))} /></label><p className="up-form-note up-full">{p.combinedNote}</p></div>}
    </fieldset>
    <aside className="up-calc-summary" aria-label={p.summary}>
      <div className="up-receipt">
        <div className="up-receipt-head"><p className="up-kicker">LUMACLEAN · BEOGRAD</p><ArrowIcon direction="down-right" /></div>
        <p className="up-review-badge"><span aria-hidden="true" />{p.reviewBadge}</p>
        <h3>{p.summary}</h3>
        <div className="up-receipt-lines">{calculation?.quote.lines.map((line, i) => <div key={i}><span>{c.types[line.type]}{line.quantity > 1 && ` × ${line.quantity}`}{line.type === "CORNER" && ` · ${items[i].seats} ${c.seats.toLowerCase()}`}</span><strong>{line.from && `${c.from} `}{formatRsd(line.amount, locale)}</strong></div>)}
          {!!calculation?.quote.minimumAdjustment && <div><span>{c.minimumAdjustment}</span><strong>{formatRsd(calculation.quote.minimumAdjustment, locale)}</strong></div>}
          {mode === "ADDON" && calculation && <div><span>{siteContent[locale].pricing.serviceNames[service]} · {area} m²</span><strong>{formatRsd(calculation.quote.cleaningBase, locale)}</strong></div>}
        </div>
        <div className="up-total" aria-live="polite" aria-atomic="true"><span>{c.total}</span><strong key={calculation?.quote.total}>{calculation && !unsafe ? `${c.from} ${formatRsd(calculation.quote.total, locale)}` : "—"}</strong></div>
        <p className="up-form-note">{p.deliveryNote}</p>
      </div>
      <fieldset disabled={locked || unsafe} className="up-contact">
        <legend className="up-sr-only">{p.contactStep}</legend>
        <div className="up-form-heading"><span>03</span><h3>{p.contactStep}</h3></div>
        <label><span>{c.nameField} *</span><input name="name" autoComplete="name" minLength={2} maxLength={100} required value={name} data-filled={!!name.trim()} onChange={e => setName(e.target.value)} aria-invalid={status === "validation" && invalidName} aria-describedby={status === "validation" ? "up-form-status" : undefined} /></label>
        <label><span>{c.phone} *</span><input name="phone" type="tel" autoComplete="tel" inputMode="tel" maxLength={40} required placeholder="+381 …" value={phone} data-filled={!!phone.trim()} onChange={e => setPhone(e.target.value)} aria-invalid={status === "validation" && invalidPhone} aria-describedby={status === "validation" ? "up-form-status" : undefined} /></label>
        <label className="up-consent"><input name="consent" type="checkbox" required checked={consent} onChange={e => setConsent(e.target.checked)} aria-invalid={status === "validation" && !consent} /><span>{c.consent} *</span></label>
        <a className="up-privacy" href={`/${locale}/privacy-policy`}>{p.privacy}</a>
        <button className="up-button up-submit" type="submit" disabled={locked || unsafe || removingId !== null}><span className="up-submit-copy"><span className="up-submit-reserve" aria-hidden="true">{c.send}</span><span>{status === "sending" ? p.sending : status === "error" || status === "limited" ? p.retry : c.send}</span></span>{status === "sending" ? <span className="up-spinner" aria-hidden="true" /> : <ArrowIcon />}</button>
      </fieldset>
      {unsafe && <UpholsteryPhotoButton locale={locale} />}
      <div className="up-status-slot">{status === "idle" && <p className="up-form-note up-review">{p.estimateNote}</p>}<p id="up-form-status" ref={statusRef} tabIndex={-1} className={`up-form-status ${status}`} role={status === "success" || status === "sending" || status === "idle" ? "status" : "alert"}>{status === "success" ? `${c.success}${reference ? ` · ${reference}` : ""}` : status === "sending" ? p.sending : status === "validation" ? p.validation : status === "limited" ? p.limited : status === "error" ? c.error : ""}</p></div>
    </aside>
  </form>;
}
