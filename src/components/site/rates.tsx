"use client";

import {useState} from "react";
import type {Locale} from "@/i18n/routing";
import type {SiteContent} from "@/lib/content";
import {formatRsd, priceMatrix, serviceIds, type ServiceId} from "@/lib/pricing";
import type {EditorialContent} from "@/lib/site-content";

export function Rates({locale, copy, pricing}: {locale: Locale; copy: EditorialContent["rates"]; pricing: SiteContent["pricing"]}) {
  const [service, setService] = useState<ServiceId>("regular");
  const [areaIndex, setAreaIndex] = useState(1);
  const selected = priceMatrix[service][areaIndex];

  return (
    <>
      <div className="rate-focus">
        <div><span>{copy.focus}</span><strong>{areaIndex === 4 ? `${pricing.from} ${selected} RSD / m²` : formatRsd(selected, locale)}</strong></div>
        <div className="rate-controls">
          <label>{copy.type}<select value={service} onChange={(event) => setService(event.target.value as ServiceId)}>{serviceIds.map((id) => <option value={id} key={id}>{pricing.serviceNames[id]}</option>)}</select></label>
          <label>{copy.area}<select value={areaIndex} onChange={(event) => setAreaIndex(Number(event.target.value))}>{pricing.area.map((area, index) => <option value={index} key={area}>{area}</option>)}</select></label>
        </div>
      </div>
      <p className="rate-mobile-hint"><span aria-hidden="true">↔</span>{copy.swipe}</p>
      <div className="rate-ledger" role="group" aria-label={copy.number}>
        <div className="ledger-row ledger-head"><span>{copy.service}</span>{pricing.area.map((area) => <span key={area}>{area}</span>)}</div>
        {serviceIds.map((id) => (
          <button className={`ledger-row ledger-button ${service === id ? "is-active" : ""}`} data-service={id} onClick={() => setService(id)} aria-pressed={service === id} key={id}>
            <strong>{pricing.serviceNames[id]}</strong>
            {priceMatrix[id].map((price, index) => <span key={index}>{index === 4 ? `${price} / m²` : new Intl.NumberFormat(locale === "en" ? "en-US" : locale === "ru" ? "ru-RU" : "sr-Latn-RS").format(price)}</span>)}
          </button>
        ))}
      </div>
      <p className="fine-print">{pricing.note}</p>
    </>
  );
}
