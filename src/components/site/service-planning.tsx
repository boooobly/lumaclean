import type {Locale} from "@/i18n/routing";
import {siteContent} from "@/lib/content";
import {basePrice, extrasPrices, formatRsd, priceMatrix, type ServiceId} from "@/lib/pricing";
import {serviceBriefs, serviceExamples, servicePlanningUi} from "@/lib/service-planning";
import {servicePageUi} from "@/lib/seo-services";
import {ArrowIcon} from "@/components/site/arrow-icon";

type Props = {locale: Locale; service: ServiceId};

export function ServicePrices({locale, service}: Props) {
  const ui = servicePlanningUi[locale];
  const example = serviceExamples[service];
  const labels = siteContent[locale].calculator.labels;
  const base = basePrice(service, example.area);
  const total = example.extras.reduce((sum, extra) => sum + extrasPrices[extra.id] * extra.quantity, base);
  return <section className="service-pricing" id="service-prices" aria-labelledby="service-prices-title">
    <div className="shell">
      <h2 id="service-prices-title">{ui.prices}</h2>
      <div className="service-pricing-grid">
        <div>
          <table className="service-rate-table">
            <caption>{siteContent[locale].pricing.serviceNames[service]}</caption>
            <thead><tr><th scope="col">{ui.area}</th><th scope="col">{ui.base}</th></tr></thead>
            <tbody>{ui.ranges.map((range, index) => <tr key={range}>
              <th scope="row">{range}</th>
              <td>{formatRsd(priceMatrix[service][index], locale)}{index === 4 && <small> {ui.perMetre}</small>}</td>
            </tr>)}</tbody>
          </table>
          <p className="service-pricing-note">{ui.priceNote}</p>
        </div>
        <aside className="service-example" aria-labelledby="service-example-title">
          <span>{ui.example}</span>
          <h3 id="service-example-title">{example.area} m²</h3>
          <dl>
            <div><dt>{ui.exampleBase}</dt><dd>{formatRsd(base, locale)}</dd></div>
            {example.extras.map(extra => <div key={extra.id}><dt>{labels[extra.id]}{extra.quantity > 1 && ` × ${extra.quantity}`}</dt><dd>{formatRsd(extrasPrices[extra.id] * extra.quantity, locale)}</dd></div>)}
            <div className="service-example-total"><dt>{ui.total}</dt><dd>{formatRsd(total, locale)}</dd></div>
          </dl>
          <p>{ui.exampleNote}</p>
          <a href="#estimate">{servicePageUi[locale].estimate}<ArrowIcon direction="down-right" /></a>
        </aside>
      </div>
    </div>
  </section>;
}

export function ServiceBrief({locale, service}: Props) {
  const ui = servicePlanningUi[locale];
  const brief = serviceBriefs[locale][service];
  return <section className="service-brief" id="service-preparation" aria-labelledby="service-brief-title">
    <div className="shell">
      <div className="section-number">04 · {ui.prepare}</div>
      <h2 id="service-brief-title">{brief.title}</h2>
      <ol>{brief.items.map((item, index) => <li key={item}><span aria-hidden="true">0{index + 1}</span><p>{item}</p></li>)}</ol>
      <div className="service-brief-footer"><p>{brief.note}</p><div><h3>{ui.next}</h3><p>{ui.nextText}</p><a href="#estimate">{servicePageUi[locale].estimate}<ArrowIcon direction="down-right" /></a></div></div>
    </div>
  </section>;
}
