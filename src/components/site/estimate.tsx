"use client";

import {isWebsitePhoneValid} from '@/lib/website-phone';
import {homepageUxCopy} from '@/lib/homepage-ux-content';
import Image from "next/image";
import {Minus, Plus} from "lucide-react";
import {Fragment, useEffect, useId, useMemo, useRef, useState} from "react";
import type {Locale} from "@/i18n/routing";
import type {SiteContent} from "@/lib/content";
import {calculatePrice, extrasPrices, formatRsd, serviceIds, type ServiceId} from "@/lib/pricing";
import type {EditorialContent} from "@/lib/site-content";

import {leadAttribution, trackEvent} from "@/lib/analytics";
import {ArrowIcon} from "@/components/site/arrow-icon";
import {enquiryCopy} from '@/lib/lead-intent';
import {AnimatedPrice} from './animated-price';

type CountExtra = "standardWindow" | "largeWindow" | "cabinets" | "ironing" | "fridge" | "oven" | "microwave" | "hood" | "dishwasher" | "washingMachine";
type ToggleExtra = "balcony" | "steam" | "petHair" | "linen";

const countKeys: CountExtra[] = ["standardWindow", "largeWindow", "cabinets", "ironing", "fridge", "oven", "microwave", "hood", "dishwasher", "washingMachine"];
const toggleKeys: ToggleExtra[] = ["balcony", "steam", "petHair", "linen"];

type EstimateProps={locale:Locale;copy:EditorialContent['estimate'];content:SiteContent;initialService?:ServiceId;initialRequest?:'CLEANING'|'UPHOLSTERY';focused?:boolean};
export function Estimate({locale, copy, content, initialService = "regular", initialRequest = 'CLEANING', focused = false}:EstimateProps) {
  const [requestMode,setRequestMode]=useState(initialRequest);
  const [upholsteryRequested,setUpholsteryRequested]=useState(initialRequest==='UPHOLSTERY');
  const onlyUpholstery=requestMode==='UPHOLSTERY';
  const hasUpholstery=onlyUpholstery||upholsteryRequested;
  const e=enquiryCopy[locale];
  const ux=homepageUxCopy[locale];
  const ExtrasDisclosure=focused?"details":"div";
  const ExtraGroup=focused?"div":Fragment;
  const started = useRef(false);
  const statusId=useId();
  const submitting = useRef(false);
  const submission = useRef<{id: string; fields: string; payload: string} | null>(null);
  const [service, setService] = useState<ServiceId>(initialService);
  const eventData = {locale, service: onlyUpholstery ? 'upholstery' : service, form_type: 'estimate'};
  const [area, setArea] = useState(55);
  const [counts, setCounts] = useState<Record<CountExtra, number>>({standardWindow: 0, largeWindow: 0, cabinets: 0, ironing: 0,fridge:0,oven:0,microwave:0,hood:0,dishwasher:0,washingMachine:0});
  const [toggles, setToggles] = useState<Record<ToggleExtra, boolean>>({balcony: false, steam: false, petHair: false, linen: false});
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
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "validation" | "error" | "limited">("idle");
  const [reference,setReference]=useState<string|null>(null);

  const calculation = useMemo(() => {
    const extras = [...countKeys.map(code => ({code, quantity:counts[code]})), ...toggleKeys.map(code => ({code, quantity:toggles[code] ? 1 : 0}))];
    const quote = calculatePrice(service,area,extras,urgent);
    const lines = [{label:`${content.pricing.serviceNames[service]} · ${area} m²`, value:quote.base}, ...quote.extras.map(e => ({label:`${content.calculator.labels[e.code]}${countKeys.includes(e.code as CountExtra) ? ` × ${e.quantity}` : ""}`,value:e.unitPrice*e.quantity}))];
    if (urgent) lines.push({label:content.calculator.urgent,value:quote.surcharge});
    return {lines,total:quote.total,extras};
  }, [area, content, counts, service, toggles, urgent]);

  const selectedExtras=Object.values(counts).filter(n=>n>0).length+Object.values(toggles).filter(Boolean).length;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || status === 'success') return;
    if ((name.trim().length > 0 && name.trim().length < 2) || !isWebsitePhoneValid(phone) || !consent) {
      setStatus("validation");
      trackEvent("lead_error", {...eventData, error_type: "validation"});
      return;
    }
    submitting.current = true;
    setReference(null);
    setStatus("sending");
    const details = calculation.lines.map((line) => `${line.label}: ${formatRsd(line.value, locale)}`).join("\n");
    const estimate = `${copy.calculation}\n${details}\n${hasUpholstery?e.cleaningPrice:copy.total}: ${formatRsd(calculation.total, locale)}${hasUpholstery?`\n${e.pending}\n${e.agreed}`:''}`;
    try {
      const fields = JSON.stringify({name, phone, comment: comment.trim() || undefined, locale, requestKind:onlyUpholstery?'UPHOLSTERY':hasUpholstery?'CLEANING_UPHOLSTERY':'CLEANING',upholsteryRequested:hasUpholstery,...(onlyUpholstery?{}:{estimate,service,area,urgent,extras:calculation.extras}), consent});
      if (!submission.current || submission.current.fields !== fields) submission.current = {id:crypto.randomUUID(),fields,payload:JSON.stringify({...JSON.parse(fields),attribution:leadAttribution()})};
      const response = await fetch("/api/lead", {method: "POST", headers: {"Content-Type": "application/json"}, signal: AbortSignal.timeout(20000), body: JSON.stringify({...JSON.parse(submission.current.payload),submissionId:submission.current.id})});
      const result = await response.json().catch(() => null);
      const success = response.ok && result?.ok === true;
      if(success&&typeof result.reference==='string')setReference(result.reference);
      setStatus(success ? "success" : response.status===429?"limited":response.status === 400 ? "validation" : "error");
      trackEvent(success ? "generate_lead" : "lead_error", {...eventData, ...(success ? {} : {error_type: "server"})});
    } catch {
      setStatus("error");
      trackEvent("lead_error", {...eventData, error_type: "network"});
    } finally { submitting.current = false; }
  }

  const urgency=<>             <label className="site-urgent"><input type="checkbox" disabled={!sameDayAllowed} checked={urgent} onChange={(event) => setUrgent(event.target.checked)}/><span>{focused?content.calculator.urgent.replace(/\s*\(\+20%\)$/u,''):content.calculator.urgent}</span><small>+20%</small></label>{!sameDayAllowed&&<p role="status">{locale==='ru'?'Срочный выезд сегодня недоступен. Другой день согласуем после заявки.':locale==='en'?'Same-day departure is unavailable. We will agree another day after your enquiry.':'Dolazak danas nije dostupan. Drugi dan dogovaramo nakon upita.'}</p>} </>;

  return (
    <form id={focused?'estimate':undefined} aria-busy={status==='sending'} className={`estimate-sheet${focused?' estimate-focused':''}${onlyUpholstery?' estimate-enquiry-only':''}`} onSubmit={submit} onFocusCapture={() => { if (!started.current) { started.current = true; trackEvent("form_start", eventData); } }} noValidate>
      <div className="estimate-form" onChange={() => trackEvent("calculator_interaction", eventData)} onClick={(event) => { if ((event.target as HTMLElement).closest("button")) trackEvent("calculator_interaction", eventData); }}>
        <label className="estimate-request-kind"><span>{e.kind}</span><select name="requestKind" value={requestMode} onChange={event=>{const kind=event.target.value as 'CLEANING'|'UPHOLSTERY';setRequestMode(kind);if(kind==='UPHOLSTERY')setUpholsteryRequested(true);if(status!=='success'&&status!=='sending')setStatus('idle');}}><option value="CLEANING">{e.cleaning}</option><option value="UPHOLSTERY">{e.only}</option></select></label>
        {!onlyUpholstery&&<><fieldset>
          <legend>{copy.service}</legend>
          <div className="service-options">
            {(focused ? ["regular", "deep"] as ServiceId[] : serviceIds).map((id) => <label key={id}><input type="radio" name="service" checked={service === id} onChange={() => setService(id)} /><span>{content.pricing.serviceNames[id]}</span></label>)}
          </div>
          {focused&&<details className="estimate-other" open={!["regular","deep"].includes(service)}><summary>{ux.other}{!["regular","deep"].includes(service)?` · ${content.pricing.serviceNames[service]}`:""}</summary><div className="service-options">{serviceIds.filter(id=>!["regular","deep"].includes(id)).map(id=><label key={id}><input type="radio" name="service" checked={service===id} onChange={()=>setService(id)}/><span>{content.pricing.serviceNames[id]}</span></label>)}</div></details>}
        </fieldset>
        <fieldset>
          <legend>{copy.area}<output>{area} m²</output></legend>
          <input className="site-area-range" type="range" min="25" max="180" style={{'--area-progress':`${(area-25)/155*100}%`} as React.CSSProperties} value={area} onChange={(event) => setArea(Number(event.target.value))} aria-label={copy.area} />
        </fieldset>
        <a className="site-mobile-total" href="#receipt">
          <span>{hasUpholstery?e.cleaningPrice:copy.total}</span><strong>{formatRsd(calculation.total, locale)}</strong><i>{copy.toReceipt}<ArrowIcon direction="down" /></i>
        </a>
        <ExtrasDisclosure className={focused?"estimate-extras-disclosure":undefined}>
          {focused&&<summary>{ux.extras}<span>{selectedExtras>0?`${ux.selected}: ${selectedExtras}`:""}</span></summary>}
        <fieldset>
          <legend className={focused?"rate-sr-only":undefined}>{copy.extras}</legend>
          <div className="extra-options site-extra-options">
            {(focused ? [countKeys.filter(k=>k==='standardWindow'||k==='largeWindow'),countKeys.filter(k=>['fridge','oven','microwave','hood','dishwasher','washingMachine'].includes(k)),countKeys.filter(k=>k==='cabinets'||k==='ironing')] : [countKeys]).map((keys,index)=><ExtraGroup key={index} {...(focused?{className:"estimate-extra-group"}:{})}>{focused&&<h4>{[ux.windows,ux.appliances,ux.care][index]}</h4>}
            {keys.map((key) => (
              <div className="site-extra-counter" key={key}>
                <span>{content.calculator.labels[key]}</span><small>+{formatRsd(extrasPrices[key], locale)}</small>
                <div><button type="button" disabled={counts[key]===0} onClick={() => setCounts((current) => ({...current, [key]: Math.max(0, current[key] - 1)}))} aria-label={`${content.calculator.labels[key]}: −`}><Minus size={13}/></button><b>{counts[key]}</b><button type="button" onClick={() => setCounts((current) => ({...current, [key]: current[key] + 1}))} aria-label={`${content.calculator.labels[key]}: +`}><Plus size={13}/></button></div>
              </div>
            ))}
            </ExtraGroup>)}
            {toggleKeys.map((key) => <label key={key}><input type="checkbox" checked={toggles[key]} onChange={(event) => setToggles((current) => ({...current, [key]: event.target.checked}))}/><span>{content.calculator.labels[key]}</span><small>+{formatRsd(extrasPrices[key], locale)}</small></label>)}
            {!focused&&urgency}

          </div>
        </fieldset>
        </ExtrasDisclosure>
        {focused&&<div className="estimate-urgency">{urgency}</div>}
        <div className="estimate-upholstery-request"><label><input type="checkbox" name="upholsteryRequested" checked={upholsteryRequested} onChange={event=>setUpholsteryRequested(event.target.checked)}/><span>{e.checkbox}</span></label><p>{e.hint}</p></div></>}
      </div>
      <aside className="receipt" id="receipt">
        <div className="receipt-head"><Image src="/brand/logo-light.svg" alt="LumaClean" width={622} height={132}/>{!focused&&<span>{copy.reference}</span>}</div>
        <div className="receipt-body">
          {!onlyUpholstery&&<><div className="receipt-meta"><span>{copy.calculation}</span><span>{copy.city}</span></div>
          <div className="receipt-lines">{calculation.lines.map((line) => <div className="receipt-line" key={line.label}><span>{line.label}</span><span>{formatRsd(line.value, locale)}</span></div>)}</div>
          <div className="receipt-total"><span>{hasUpholstery?e.cleaningPrice:copy.total}</span>{focused?<><strong aria-hidden="true"><AnimatedPrice value={calculation.total} locale={locale}/><small>RSD</small></strong><output className="rate-sr-only" aria-live="polite" aria-atomic="true">{formatRsd(calculation.total,locale)}</output></>:<strong>{formatRsd(calculation.total, locale)}</strong>}</div>
          <p>{copy.note}</p></>}
          {hasUpholstery&&<div className="estimate-review-note"><p>{onlyUpholstery?e.onlyPrice:e.pending}</p><small>{e.agreed}</small></div>}
          <div className="site-lead-fields">
            <label><span>{copy.name}</span><input name="name" value={name} onChange={(event) => setName(event.target.value)} placeholder={copy.name} autoComplete="name" maxLength={100} aria-describedby={status==='validation'?statusId:undefined} aria-invalid={status === "validation" && name.trim().length > 0 && name.trim().length < 2}/></label>
            <label><span>{copy.phone}</span><input type="tel" name="phone" maxLength={40} value={phone} onChange={(event) => setPhone(event.target.value)} placeholder={copy.phone} autoComplete="tel" inputMode="tel" required aria-describedby={status==='validation'?statusId:undefined} aria-invalid={status === "validation" && !isWebsitePhoneValid(phone)}/></label>
            {focused?<details className="site-comment"><summary>{copy.comment} · {ux.optional}</summary><label><span>{copy.comment}</span><textarea name="comment" value={comment} onChange={(event) => setComment(event.target.value)} placeholder={hasUpholstery?e.placeholder:copy.commentHint} maxLength={1000} rows={2}/></label></details>:<label className="site-comment"><span>{copy.comment}</span><textarea name="comment" value={comment} onChange={(event) => setComment(event.target.value)} placeholder={hasUpholstery?e.placeholder:copy.commentHint} maxLength={1000} rows={2}/></label>}
            <label className="site-consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} required aria-describedby={status==='validation'?statusId:undefined} aria-invalid={status === "validation" && !consent}/><span>{copy.consent}</span></label>
          </div>
          <p className="estimate-enquiry-note">{ux.enquiry}</p>
          <button type="submit" disabled={status === "sending" || status === 'success'}>{status === "sending" ? copy.sending : hasUpholstery?e.send:copy.send}<span><ArrowIcon /></span></button>
          {status === "success" && <div className="site-form-status success" role="status"><p>{hasUpholstery?e.success:copy.success}</p>{reference&&<p className="estimate-reference">{locale==='ru'?'Номер заявки':locale==='en'?'Enquiry reference':'Broj upita'}: <strong>{reference}</strong></p>}</div>}
          {status === "validation" && <p id={statusId} className="site-form-status error" role="alert">{copy.validation}</p>}
          {status === "limited" && <p className="site-form-status error" role="alert">{locale==='ru'?'Слишком много заявок. Подождите немного и повторите попытку.':locale==='en'?'Too many enquiries. Please wait a little and try again.':'Previše upita. Sačekajte malo i pokušajte ponovo.'}</p>}
          {status === "error" && <p className="site-form-status error" role="alert">{copy.error}</p>}
        </div>
      </aside>
    </form>
  );
}
