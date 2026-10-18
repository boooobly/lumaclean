"use client";

import {Check, ChevronDown, Minus, Plus, ArrowUpRight, CalendarDays} from 'lucide-react';
import {useEffect, useMemo, useRef, useState} from 'react';
import {isPossiblePhoneNumber} from 'libphonenumber-js/min';
import type {Locale} from '@/i18n/routing';
import type {SiteContent} from '@/lib/content';
import type {EditorialContent} from '@/lib/site-content';
import {calculatePrice, extrasPrices, formatRsd, priceMatrix, serviceIds, type ServiceId} from '@/lib/pricing';
import {leadAttribution, trackEvent} from '@/lib/analytics';
import {enquiryCopy} from '@/lib/lead-intent';
import {conversionContent} from '@/lib/conversion-content';
import './conversion.css';

const countGroups = [ ['standardWindow','largeWindow'], ['fridge','oven','microwave','hood','dishwasher','washingMachine'], ['cabinets','ironing'] ] as const;
const toggleKeys = ['balcony','steam','petHair','linen'] as const;
type Extra = keyof typeof extrasPrices;
type Policy = {allowed:boolean; today:string; earliestDate:string; timezone:string; checkedAt:string};
type Props={locale:Locale;copy:EditorialContent['estimate'];content:SiteContent;initialService?:ServiceId;initialRequest?:'CLEANING'|'UPHOLSTERY'};

export function Estimate({locale,copy,content,initialService='regular',initialRequest='CLEANING'}:Props) {
  const t=conversionContent[locale], e=enquiryCopy[locale];
  const [requestMode,setRequestMode]=useState(initialRequest);
  const [upholsteryRequested,setUpholsteryRequested]=useState(initialRequest==='UPHOLSTERY');
  const [service,setService]=useState<ServiceId>(initialService);
  const [areaText,setAreaText]=useState('55');
  const [quantities,setQuantities]=useState<Partial<Record<Extra,number>>>({});
  const [heavy,setHeavy]=useState(false);
  const [preferredDate,setPreferredDate]=useState('');
  const [preferredTime,setPreferredTime]=useState('');
  const [preferredChannel,setPreferredChannel]=useState('');
  const [policy,setPolicy]=useState<Policy|null>(null);
  const [policyFailed,setPolicyFailed]=useState(false);
  const [policyRevision,setPolicyRevision]=useState(0);
  const [name,setName]=useState(''), [phone,setPhone]=useState(''), [comment,setComment]=useState('');
  const [consent,setConsent]=useState(false);
  const [status,setStatus]=useState<'idle'|'sending'|'success'|'validation'|'error'>('idle');
  const [serverError,setServerError]=useState('');
  const [reference,setReference]=useState('');
  const [priceVisible,setPriceVisible]=useState(false);
  const summaryRef=useRef<HTMLDivElement>(null);
  const started=useRef(false),contactStarted=useRef(false),submitting=useRef(false);
  const submission=useRef<{id:string;payload:string}|null>(null);
  const onlyUpholstery=requestMode==='UPHOLSTERY', hasUpholstery=onlyUpholstery||upholsteryRequested;
  const area=Number(areaText), validArea=areaText.trim()!==''&&Number.isFinite(area)&&area>=25&&area<=180&&Math.abs(area*100-Math.round(area*100))<0.00001;
  const urgent=!!preferredDate&&preferredDate===policy?.today&&policy.allowed;
  const invalidDate=!!preferredDate&&(!policy||policyFailed||preferredDate<policy.earliestDate);
  const validPhone=isPossiblePhoneNumber(phone.trim().replace(/^00/,'+'),'RS');
  const track=(event:Parameters<typeof trackEvent>[0])=>trackEvent(event,{locale,service,flow_version:'conversion_v1'});

  useEffect(()=>{
    let active=true;
    const refresh=async()=>{try{
      const response=await fetch('/api/booking-policy',{cache:'no-store'}),data=await response.json();
      if(!response.ok||!/^\d{4}-\d{2}-\d{2}$/.test(data.today)||!/^\d{4}-\d{2}-\d{2}$/.test(data.earliestDate)||data.timezone!=='Europe/Belgrade')throw Error('policy');
      if(active){setPolicy(data);setPolicyFailed(false);}
    }catch{if(active)setPolicyFailed(true);}};
    void refresh(); const timer=setInterval(refresh,15000);
    return()=>{active=false;clearInterval(timer);};
  },[preferredDate,policyRevision]);
  useEffect(()=>{
    const select=(event:Event)=>{const id=(event as CustomEvent).detail?.service;if(serviceIds.includes(id)){setService(id);setRequestMode('CLEANING');}};
    window.addEventListener('lc-service-select',select);
    return()=>window.removeEventListener('lc-service-select',select);
  },[]);
  useEffect(()=>{
    const node=summaryRef.current;if(!node)return;
    const observer=new IntersectionObserver(entries=>setPriceVisible(entries.some(entry=>entry.isIntersecting)),{threshold:.3});
    observer.observe(node);return()=>observer.disconnect();
  },[]);

  const calculation=useMemo(()=>{
    const extras=Object.entries(quantities).filter(([,quantity])=>quantity!>0).map(([code,quantity])=>({code:code as Extra,quantity:quantity!}));
    return {...calculatePrice(service,validArea?area:55,extras,urgent),inputExtras:extras};
  },[service,area,validArea,quantities,urgent]);
  useEffect(()=>{
    if(!priceVisible||!validArea||onlyUpholstery)return;
    const timer=setTimeout(()=>trackEvent('price_view',{locale,service,flow_version:'conversion_v1'}),350);
    return()=>clearTimeout(timer);
  },[priceVisible,validArea,onlyUpholstery,locale,service,calculation.total]);

  function choose(id:ServiceId){setService(id);window.dispatchEvent(new CustomEvent('lc-service-select',{detail:{service:id}}));trackEvent('service_select',{locale,service:id,flow_version:'conversion_v1'});}
  function chooseDate(date:string){
    setPreferredDate(date);setServerError('');
    trackEvent('preferred_date_select',{locale,service,flow_version:'conversion_v1',date_choice:!date?'later':date===policy?.today?'today':'future'});
  }
  function updateExtra(code:Extra,quantity:number){setQuantities(current=>({...current,[code]:Math.max(0,Math.min(100,quantity))}));track('calculator_interaction');}
  function counter(code:Extra,group:number){
    const quantity=quantities[code]??0;
    return <div className="flow-counter" key={code}>
      <div><span>{content.calculator.labels[code]}</span><small>{formatRsd(extrasPrices[code],locale)}{group<2?` · ${group===0?t.perWindow:t.perItem}`:''}</small></div>
      <div className="flow-stepper"><button type="button" disabled={!quantity} onClick={()=>updateExtra(code,quantity-1)} aria-label={`${content.calculator.labels[code]}: −`}><Minus size={15}/></button><output aria-live="polite">{quantity}</output><button type="button" disabled={quantity>=100} onClick={()=>updateExtra(code,quantity+1)} aria-label={`${content.calculator.labels[code]}: +`}><Plus size={15}/></button></div>
    </div>;
  }
  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();if(submitting.current||status==='success')return;
    setServerError('');
    if(!validPhone||!consent||name.trim().length>100||(!onlyUpholstery&&!validArea)||invalidDate){
      setStatus('validation');trackEvent('lead_error',{locale,service,error_type:'validation',flow_version:'conversion_v1'});
      const field=!validArea&&!onlyUpholstery?'area':invalidDate?'preferredDate':!validPhone?'phone':name.trim().length>100?'name':'consent';
      event.currentTarget.querySelector<HTMLElement>(`[name="${field}"]`)?.focus();return;
    }
    submitting.current=true;setStatus('sending');
    const estimate=[t.preliminary,`${content.pricing.serviceNames[service]} · ${area} m²: ${formatRsd(calculation.base,locale)}`,...calculation.extras.map(line=>`${content.calculator.labels[line.code]} × ${line.quantity}: ${formatRsd(line.unitPrice*line.quantity,locale)}`),urgent?`${t.today}: +20%`:null,`${heavy?t.base:t.preliminary}: ${formatRsd(calculation.total,locale)}`,heavy?t.heavyHint:null,hasUpholstery?t.separate:null,t.note].filter(Boolean).join('\n');
    try{
      const payload=JSON.stringify({name:name.trim()||undefined,phone,comment:comment.trim()||undefined,locale,requestKind:onlyUpholstery?'UPHOLSTERY':hasUpholstery?'CLEANING_UPHOLSTERY':'CLEANING',upholsteryRequested:hasUpholstery,preferredDate:preferredDate||undefined,preferredTime:preferredTime||undefined,preferredChannel:preferredChannel||undefined,...(onlyUpholstery?{}:{estimate,service,area,urgent,soilLevel:heavy?'HEAVY':'NORMAL',extras:calculation.inputExtras}),consent,attribution:leadAttribution()});
      if(!submission.current||submission.current.payload!==payload)submission.current={id:crypto.randomUUID(),payload};
      const response=await fetch('/api/lead',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...JSON.parse(payload),submissionId:submission.current.id})});
      const result=await response.json().catch(()=>null);
      if(response.ok&&result?.ok===true){setReference(typeof result.reference==='string'?result.reference:'');setStatus('success');track('generate_lead');}
      else{
        setStatus('error');
        if(['SAME_DAY_CUTOFF','PAST_SERVICE_DATE'].includes(result?.error)){setServerError(t.cutoff);setPolicyRevision(v=>v+1);}
        else if(result?.error==='INVALID_PHONE')setServerError(t.phoneError);
        trackEvent('lead_error',{locale,service,error_type:'server',flow_version:'conversion_v1'});
      }
    }catch{setStatus('error');trackEvent('lead_error',{locale,service,error_type:'network',flow_version:'conversion_v1'});}
    finally{submitting.current=false;}
  }

  const totalText=onlyUpholstery?t.review:validArea?formatRsd(calculation.total,locale):'—';
  const tomorrow=policy?new Date(new Date(`${policy.today}T12:00:00Z`).getTime()+86400000).toISOString().slice(0,10):'';
  return <form className="booking-flow" onSubmit={submit} noValidate onFocusCapture={()=>{if(!started.current){started.current=true;track('form_start');}}}>
    <div className="flow-main">
      {!onlyUpholstery&&<>
        <fieldset className="flow-section" id="scope"><legend><span>01</span>{t.choose}</legend>
          <div className="flow-service-cards">{(['regular','deep'] as const).map(id=><label className={`flow-service-card ${service===id?'is-selected':''}`} key={id}>
            <input type="radio" name="service" value={id} checked={service===id} onChange={()=>choose(id)}/>
            <span className="flow-card-top"><span>{content.pricing.serviceNames[id]}</span><span className="flow-radio" aria-hidden="true">{service===id&&<Check size={14}/>}</span></span>
            <small>{t.cards[id==='regular'?0:1]}</small><strong>{content.pricing.from} {formatRsd(priceMatrix[id][0],locale)}</strong>
          </label>)}</div>
          <details className="flow-secondary" open={service!=='regular'&&service!=='deep'||undefined}><summary>{t.other}<ChevronDown size={16}/></summary><div className="flow-other-services">{(['move','airbnb','office'] as const).map(id=><label key={id}><input type="radio" name="service" value={id} checked={service===id} onChange={()=>choose(id)}/><span>{content.pricing.serviceNames[id]}</span><small>{content.pricing.from} {formatRsd(priceMatrix[id][0],locale)}</small></label>)}</div></details>
        </fieldset>
        <fieldset className="flow-section"><legend><span>02</span>{t.area}</legend>
          <div className="flow-area"><label htmlFor="flow-area" className="flow-area-input"><input id="flow-area" name="area" type="number" min="25" max="180" step="0.01" inputMode="decimal" value={areaText} onChange={event=>{setAreaText(event.target.value);track('calculator_interaction');}} aria-describedby="flow-area-hint" aria-invalid={status==='validation'&&!validArea}/><span>m²</span></label><p id="flow-area-hint">{t.areaHint}</p></div>
          <div className="flow-live-price" aria-live="polite"><span>{heavy?t.base:t.preliminary}</span><output>{totalText}</output></div>
          {status==='validation'&&!validArea&&<p className="flow-error" role="alert">{t.areaError}</p>}
          <p className="flow-condition"><Check size={15} aria-hidden="true"/>{t.standard}</p>
          <label className="flow-check"><input type="checkbox" checked={heavy} onChange={event=>setHeavy(event.target.checked)}/><span>{t.heavy}</span></label>
          {heavy&&<p className="flow-notice">{t.heavyHint}</p>}
        </fieldset>
        <section className="flow-section flow-inclusions" aria-labelledby="flow-included"><h3 id="flow-included"><span>03</span>{t.included}</h3><p>{content.services.find(item=>item.id===service)?.description}</p>
          <ul className="flow-scope-highlights">{(service==='regular'||service==='deep'?content.comparison[service].items:[]).map(item=><li key={item}><Check size={14} aria-hidden="true"/>{item}</li>)}</ul>
          <details><summary>{t.compare}<ChevronDown size={16}/></summary><div className="flow-comparison"><table><thead><tr><th scope="col">{t.included}</th><th scope="col">{content.pricing.serviceNames.regular}</th><th scope="col">{content.pricing.serviceNames.deep}</th></tr></thead><tbody>{t.rows.map((label,index)=><tr key={label}><th scope="row">{label}</th><td>{index<3?t.yes:index===3||index===6?t.no:t.extra}</td><td>{index<4?t.yes:index===6?t.load:t.extra}</td></tr>)}</tbody></table></div><p>{t.scopeNote}</p></details>
        </section>
        <details className="flow-section flow-extras" onToggle={event=>{if(event.currentTarget.open)track('extras_open');}}><summary><span className="flow-section-title"><span>04</span>{t.add}</span><span className="flow-selected-count">{calculation.inputExtras.length?`${t.selected}: ${calculation.inputExtras.length}`:''}<ChevronDown size={19}/></span></summary>
          {countGroups.map((codes,index)=><fieldset className="flow-extra-group" key={index}><legend>{t.groups[index]}</legend>{index===0&&<p>{t.windowNote}</p>}{codes.map(code=>counter(code,index))}{index===2&&toggleKeys.map(code=><label className="flow-toggle" key={code}><input type="checkbox" checked={!!quantities[code]} onChange={event=>updateExtra(code,event.target.checked?1:0)}/><span>{content.calculator.labels[code]}</span><small>{formatRsd(extrasPrices[code],locale)}</small></label>)}</fieldset>)}
          <fieldset className="flow-extra-group"><legend>{t.groups[3]}</legend><label className="flow-check"><input type="checkbox" name="upholsteryRequested" checked={upholsteryRequested} onChange={event=>setUpholsteryRequested(event.target.checked)}/><span>{e.checkbox}</span></label><p>{t.separate}</p><button type="button" className="flow-text-button" onClick={()=>setRequestMode('UPHOLSTERY')}>{e.only}<ArrowUpRight size={15}/></button></fieldset>
        </details>
      </>}
      {onlyUpholstery&&<section className="flow-section"><h3>{e.only}</h3><p>{t.separate}</p><button type="button" className="flow-text-button" onClick={()=>setRequestMode('CLEANING')}>{e.cleaning}<ArrowUpRight size={15}/></button></section>}
      <fieldset className="flow-section"><legend><span>05</span>{t.dateTitle}</legend><p>{t.dateNote}</p>
        <div className="flow-date-choices"><button type="button" aria-pressed={!preferredDate} onClick={()=>chooseDate('')}>{t.later}</button>{policy?.allowed&&<button type="button" aria-pressed={preferredDate===policy.today} onClick={()=>chooseDate(policy.today)}>{t.today} +20%</button>}{tomorrow&&<button type="button" aria-pressed={preferredDate===tomorrow} onClick={()=>chooseDate(tomorrow)}>{t.tomorrow}</button>}</div>
        <div className="flow-date-fields"><label><span><CalendarDays size={16}/>{t.date}</span><input name="preferredDate" type="date" value={preferredDate} min={policy?.earliestDate} onChange={event=>chooseDate(event.target.value)} aria-invalid={invalidDate} aria-describedby="flow-date-state"/></label><label><span>{t.time}</span><select value={preferredTime} onChange={event=>setPreferredTime(event.target.value)}><option value="">{t.anytime}</option>{['MORNING','AFTERNOON','EVENING'].map((value,index)=><option value={value} key={value}>{t.times[index]}</option>)}</select></label></div>
        <div id="flow-date-state" aria-live="polite">{urgent&&<p className="flow-notice">{t.urgent}</p>}{invalidDate&&<p className="flow-error">{policy&&!policyFailed?t.cutoff:policyFailed?t.policyError:t.checking}</p>}{policyFailed&&<button type="button" className="flow-text-button" onClick={()=>setPolicyRevision(v=>v+1)}>{t.refresh}</button>}</div>
      </fieldset>
    </div>
    <aside className="flow-summary" id="receipt">
      <div className="flow-quote" ref={summaryRef}><span className="flow-eyebrow">LumaClean / {copy.city}</span><h3>{t.summary}</h3>
        {!onlyUpholstery&&<><div className="flow-quote-service"><span>{content.pricing.serviceNames[service]}</span><span>{validArea?`${area} m²`:'—'}</span></div><div className="flow-quote-lines"><div><span>{t.base}</span><b>{validArea?formatRsd(calculation.base,locale):'—'}</b></div>{calculation.extras.map(line=><div key={line.code}><span>{content.calculator.labels[line.code]} × {line.quantity}</span><b>{formatRsd(line.unitPrice*line.quantity,locale)}</b></div>)}{urgent&&<div><span>{t.today} +20%</span><b>{formatRsd(calculation.surcharge,locale)}</b></div>}</div></>}
        <div className="flow-price" aria-live="polite" aria-atomic="true"><span>{heavy&&!onlyUpholstery?t.base:t.preliminary}</span><strong>{totalText}</strong></div><p>{heavy?t.heavyHint:t.note}</p>{hasUpholstery&&<p className="flow-review">{t.separate}</p>}
        <a className="flow-contact-link" href="#flow-contact">{t.toContact}<ArrowUpRight size={18}/></a>
      </div>
      <section className="flow-contact" id="flow-contact" aria-labelledby="flow-contact-title"><span className="flow-eyebrow">06 / {copy.city}</span><h3 id="flow-contact-title">{t.contact}</h3>
        {status==='success'?<div className="flow-success" role="status" tabIndex={-1}><Check size={24}/><p>{t.success}</p>{reference&&<p>{t.reference}<strong>{reference}</strong></p>}</div>:<>
          <label><span>{t.phone} *</span><input name="phone" type="tel" inputMode="tel" autoComplete="tel" required value={phone} maxLength={40} placeholder="+381 …" onChange={event=>setPhone(event.target.value)} onFocus={()=>{if(!contactStarted.current){contactStarted.current=true;track('contact_start');}}} aria-describedby="flow-phone-hint" aria-invalid={status==='validation'&&!validPhone}/></label><p id="flow-phone-hint">{status==='validation'&&!validPhone?<span className="flow-error">{t.phoneError}</span>:t.phoneHint}</p>
          <label><span>{t.name}</span><input name="name" autoComplete="name" value={name} maxLength={100} onChange={event=>setName(event.target.value)} aria-invalid={status==='validation'&&name.trim().length>100}/></label>
          <label><span>{t.channel}</span><select value={preferredChannel} onChange={event=>setPreferredChannel(event.target.value)}><option value="">{t.noPreference}</option><option value="WHATSAPP">WhatsApp</option><option value="TELEGRAM">Telegram</option><option value="VIBER">Viber</option></select></label>
          <label><span>{t.comment}</span><textarea name="comment" value={comment} maxLength={1000} rows={2} onChange={event=>setComment(event.target.value)} placeholder={onlyUpholstery?e.placeholder:t.commentHint}/></label>
          <label className="flow-check flow-consent"><input name="consent" type="checkbox" required checked={consent} onChange={event=>setConsent(event.target.checked)} aria-invalid={status==='validation'&&!consent}/><span>{copy.consent} * <a href={`/${locale}/privacy-policy`}>{t.privacy}</a></span></label>
          {status==='validation'&&!consent&&<p className="flow-error" role="alert">{t.consentError}</p>}
          <button className="flow-submit" type="submit" disabled={status==='sending'}>{status==='sending'?copy.sending:t.send}<ArrowUpRight size={20}/></button><p>{t.dateNote}</p>
          {status==='error'&&<p className="flow-error" role="alert">{serverError||copy.error}</p>}
        </>}
      </section>
    </aside>
  </form>;
}
