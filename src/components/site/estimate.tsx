"use client";

import Image from "next/image";
import {Minus, Plus} from "lucide-react";
import {useEffect, useMemo, useRef, useState} from "react";
import type {Locale} from "@/i18n/routing";
import type {SiteContent} from "@/lib/content";
import {calculatePrice, extrasPrices, formatRsd, serviceIds, type ServiceId} from "@/lib/pricing";
import type {EditorialContent} from "@/lib/site-content";

import {leadAttribution, trackEvent} from "@/lib/analytics";
import {ArrowIcon} from "@/components/site/arrow-icon";

type CountExtra = "standardWindow" | "largeWindow" | "cabinets" | "ironing";
type ToggleExtra = "balcony" | "fridge" | "oven" | "steam" | "petHair" | "linen";

const countKeys: CountExtra[] = ["standardWindow", "largeWindow", "cabinets", "ironing"];
const toggleKeys: ToggleExtra[] = ["balcony", "fridge", "oven", "steam", "petHair", "linen"];

export function Estimate({locale, copy, content, initialService = "regular"}: {locale: Locale; copy: EditorialContent["estimate"]; content: SiteContent; initialService?: ServiceId}) {
  const started = useRef(false);
  const submitting = useRef(false);
  const submission = useRef<{id: string; payload: string} | null>(null);
  const [service, setService] = useState<ServiceId>(initialService);
  const [area, setArea] = useState(55);
  const [counts, setCounts] = useState<Record<CountExtra, number>>({standardWindow: 0, largeWindow: 0, cabinets: 0, ironing: 0});
  const [toggles, setToggles] = useState<Record<ToggleExtra, boolean>>({balcony: false, fridge: false, oven: false, steam: false, petHair: false, linen: false});
  const [urgent, setUrgent] = useState(false);
  const [sameDayAllowed,setSameDayAllowed]=useState(false);
  useEffect(()=>{
    let active=true;
    const refresh=async()=>{try{const response=await fetch('/api/booking-policy',{cache:'no-store'});const policy=await response.json();if(active){const allowed=response.ok&&policy.allowed===true;setSameDayAllowed(allowed);if(!allowed)setUrgent(false);}}catch{if(active){setSameDayAllowed(false);setUrgent(false);}}};
    void refresh();const timer=setInterval(refresh,15000);
    return()=>{active=false;clearInterval(timer);};
  },[]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [comment, setComment] = useState("");
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "validation" | "error">("idle");

  const calculation = useMemo(() => {
    const extras = [...countKeys.map(code => ({code, quantity:counts[code]})), ...toggleKeys.map(code => ({code, quantity:toggles[code] ? 1 : 0}))];
    const quote = calculatePrice(service,area,extras,urgent);
    const lines = [{label:`${content.pricing.serviceNames[service]} · ${area} m²`, value:quote.base}, ...quote.extras.map(e => ({label:`${content.calculator.labels[e.code]}${countKeys.includes(e.code as CountExtra) ? ` × ${e.quantity}` : ""}`,value:e.unitPrice*e.quantity}))];
    if (urgent) lines.push({label:content.calculator.urgent,value:quote.surcharge});
    return {lines,total:quote.total,extras};
  }, [area, content, counts, service, toggles, urgent]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    if (name.trim().length < 2 || phone.trim().length < 6 || !consent) {
      setStatus("validation");
      trackEvent("lead_error", {locale, service, error_type: "validation"});
      return;
    }
    submitting.current = true;
    setStatus("sending");
    const details = calculation.lines.map((line) => `${line.label}: ${formatRsd(line.value, locale)}`).join("\n");
    const estimate = `${copy.calculation}\n${details}\n${copy.total}: ${formatRsd(calculation.total, locale)}`;
    try {
      const payload = JSON.stringify({name, phone, comment: comment.trim() || undefined, estimate, locale, service, area, urgent, extras:calculation.extras, consent, attribution: leadAttribution()});
      if (!submission.current || submission.current.payload !== payload) submission.current = {id:crypto.randomUUID(),payload};
      const response = await fetch("/api/lead", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({...JSON.parse(payload),submissionId:submission.current.id})});
      const result = await response.json().catch(() => null);
      const success = response.ok && result?.ok === true;
      setStatus(success ? "success" : "error");
      trackEvent(success ? "generate_lead" : "lead_error", {locale, service, ...(success ? {} : {error_type: "server"})});
    } catch {
      setStatus("error");
      trackEvent("lead_error", {locale, service, error_type: "network"});
    } finally { submitting.current = false; }
  }

  return (
    <form className="estimate-sheet" onSubmit={submit} onFocusCapture={() => { if (!started.current) { started.current = true; trackEvent("form_start", {locale, service}); } }} noValidate>
      <div className="estimate-form" onChange={() => trackEvent("calculator_interaction", {locale, service})} onClick={(event) => { if ((event.target as HTMLElement).closest("button")) trackEvent("calculator_interaction", {locale, service}); }}>
        <fieldset>
          <legend>{copy.service}</legend>
          <div className="service-options">
            {serviceIds.map((id) => <label key={id}><input type="radio" name="service" checked={service === id} onChange={() => setService(id)} /><span>{content.pricing.serviceNames[id]}</span></label>)}
          </div>
        </fieldset>
        <fieldset>
          <legend>{copy.area}<output>{area} m²</output></legend>
          <input className="site-area-range" type="range" min="25" max="180" value={area} onChange={(event) => setArea(Number(event.target.value))} aria-label={copy.area} />
        </fieldset>
        <a className="site-mobile-total" href="#receipt">
          <span>{copy.total}</span><strong>{formatRsd(calculation.total, locale)}</strong><i>{copy.toReceipt}<ArrowIcon direction="down" /></i>
        </a>
        <fieldset>
          <legend>{copy.extras}</legend>
          <div className="extra-options site-extra-options">
            {countKeys.map((key) => (
              <div className="site-extra-counter" key={key}>
                <span>{content.calculator.labels[key]}</span><small>+{formatRsd(extrasPrices[key], locale)}</small>
                <div><button type="button" onClick={() => setCounts((current) => ({...current, [key]: Math.max(0, current[key] - 1)}))} aria-label={`${content.calculator.labels[key]}: −`}><Minus size={13}/></button><b>{counts[key]}</b><button type="button" onClick={() => setCounts((current) => ({...current, [key]: current[key] + 1}))} aria-label={`${content.calculator.labels[key]}: +`}><Plus size={13}/></button></div>
              </div>
            ))}
            {toggleKeys.map((key) => <label key={key}><input type="checkbox" checked={toggles[key]} onChange={(event) => setToggles((current) => ({...current, [key]: event.target.checked}))}/><span>{content.calculator.labels[key]}</span><small>+{formatRsd(extrasPrices[key], locale)}</small></label>)}
            <label className="site-urgent"><input type="checkbox" disabled={!sameDayAllowed} checked={urgent} onChange={(event) => setUrgent(event.target.checked)}/><span>{content.calculator.urgent}</span><small>+20%</small></label>{!sameDayAllowed&&<p role="status">{locale==='ru'?'Выезд сегодня уже недоступен — ближайшая запись с завтра.':locale==='en'?'Same-day departure is unavailable; the next booking date is tomorrow.':'Dolazak danas nije dostupan; najraniji termin je sutra.'}</p>}
          </div>
        </fieldset>
      </div>
      <aside className="receipt" id="receipt">
        <div className="receipt-head"><Image src="/brand/logo-light.svg" alt="LumaClean" width={622} height={132}/><span>{copy.reference}</span></div>
        <div className="receipt-body">
          <div className="receipt-meta"><span>{copy.calculation}</span><span>{copy.city}</span></div>
          <div className="receipt-lines">{calculation.lines.map((line) => <div className="receipt-line" key={line.label}><span>{line.label}</span><span>{formatRsd(line.value, locale)}</span></div>)}</div>
          <div className="receipt-total"><span>{copy.total}</span><strong>{formatRsd(calculation.total, locale)}</strong></div>
          <p>{copy.note}</p>
          <div className="site-lead-fields">
            <label><span>{copy.name}</span><input name="name" value={name} onChange={(event) => setName(event.target.value)} placeholder={copy.name} autoComplete="name" required aria-invalid={status === "validation" && name.trim().length < 2}/></label>
            <label><span>{copy.phone}</span><input name="phone" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder={copy.phone} autoComplete="tel" inputMode="tel" required aria-invalid={status === "validation" && phone.trim().length < 6}/></label>
            <label className="site-comment"><span>{copy.comment}</span><textarea name="comment" value={comment} onChange={(event) => setComment(event.target.value)} placeholder={copy.commentHint} maxLength={1000} rows={4}/></label>
            <label className="site-consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} required aria-invalid={status === "validation" && !consent}/><span>{copy.consent}</span></label>
          </div>
          <button type="submit" disabled={status === "sending"}>{status === "sending" ? copy.sending : copy.send}<span><ArrowIcon /></span></button>
          {status === "success" && <p className="site-form-status success" role="status">{copy.success}</p>}
          {status === "validation" && <p className="site-form-status error" role="alert">{copy.validation}</p>}
          {status === "error" && <p className="site-form-status error" role="alert">{copy.error}</p>}
        </div>
      </aside>
    </form>
  );
}
