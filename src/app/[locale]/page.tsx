import Image from "next/image";
import Link from "next/link";
import {Golos_Text, Onest} from "next/font/google";
import {hasLocale} from "next-intl";
import {setRequestLocale} from "next-intl/server";
import {notFound} from "next/navigation";
import {ApartmentExperience} from "@/components/apartment-experience";
import {Estimate} from "@/components/site/estimate";
import {JourneyHandoff} from "@/components/site/journey-handoff";
import {SiteHeader} from "@/components/site/site-header";
import {Rates} from "@/components/site/rates";
import {routing, type Locale} from "@/i18n/routing";
import {getMessengerLinks} from "@/lib/contacts";
import {siteContent} from "@/lib/content";
import {extrasPrices, formatRsd} from "@/lib/pricing";
import {editorialContent} from "@/lib/site-content";
import "./site.css";

const displayFont = Onest({subsets: ["latin", "cyrillic"], variable: "--font-lc-display", display: "swap"});
const textFont = Golos_Text({subsets: ["latin", "cyrillic"], variable: "--font-lc-text", display: "swap"});

export default async function HomePage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const c = siteContent[locale];
  const v = editorialContent[locale];
  const messengerLinks = getMessengerLinks(locale);
  const extraKeys = ["standardWindow", "largeWindow", "balcony", "fridge", "oven", "cabinets", "ironing", "steam", "petHair", "linen"] as const;
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://lumacleanrs.com").replace(/\/$/, "");
  const localBusinessJsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "LumaClean",
    url: `${siteUrl}/${locale}`,
    description: c.hero.body,
    areaServed: {"@type": "City", name: "Belgrade"},
    currenciesAccepted: "RSD",
    availableLanguage: ["sr", "ru", "en"],
    priceRange: "$$",
  };
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: c.faq.items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {"@type": "Answer", text: item.a},
    })),
  };

  return (
    <div id="top" className={`site-page ${displayFont.variable} ${textFont.variable}`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(localBusinessJsonLd).replace(/</g, "\\u003c")}}/>
      <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c")}}/>
      <SiteHeader locale={locale} copy={v.nav}/>
      <main>
        <ApartmentExperience locale={locale} calculatorHref="#estimate" finalFrameSrc="/media/kitchen-clean.webp"/>
        <JourneyHandoff copy={v.handoff}/>

        <section className="editorial-section scope-section" id="scope">
          <div className="shell">
            <div className="section-number">{v.scope.number}</div>
            <div className="section-intro split-intro"><h2>{v.scope.title}</h2><p>{v.scope.body}</p></div>
            <div className="scope-comparison">
              {[c.comparison.regular, c.comparison.deep].map((item, index) => (
                <article className={index ? "scope-deep" : ""} key={item.title}>
                  <div className="scope-index">{index ? v.scope.deep : v.scope.regular}</div>
                  <h3>{item.title}</h3><p>{item.text}</p>
                  <ul>{item.items.map((line) => <li key={line}>{line}</li>)}</ul>
                  <div className="scope-price"><span>{c.pricing.from}</span><strong>{new Intl.NumberFormat(locale === "en" ? "en-US" : locale === "ru" ? "ru-RU" : "sr-Latn-RS").format(index ? 9800 : 4100)}</strong><small>RSD</small></div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="editorial-section rates-section" id="rates">
          <div className="shell">
            <div className="section-number">{v.rates.number}</div>
            <div className="rates-head"><h2>{v.rates.title}</h2><div><p>{v.rates.body}</p><a href="#estimate">{v.rates.link} ↘</a></div></div>
            <Rates locale={locale} copy={v.rates} pricing={c.pricing}/>
          </div>
        </section>

        <section className="material-section" id="services">
          <div className="shell">
            <div className="section-number">{v.materials.number}</div>
            <div className="section-intro split-intro"><h2>{v.materials.title}</h2><p>{v.materials.body}</p></div>
            <div className="material-stories">
              <figure className="material-large"><Image src="/media/material-mirror.webp" alt={v.materials.mirror} fill sizes="(max-width: 900px) 100vw, 62vw"/><figcaption><span>{v.materials.mirror}</span><strong>{c.pricing.from} {formatRsd(extrasPrices.standardWindow, locale)}</strong></figcaption></figure>
              <figure><Image src="/media/material-chrome.webp" alt={v.materials.steam} fill sizes="(max-width: 900px) 100vw, 38vw"/><figcaption><span>{v.materials.steam}</span><strong>{c.pricing.from} {formatRsd(extrasPrices.steam, locale)}</strong></figcaption></figure>
              <figure><Image src="/media/material-cabinet.webp" alt={v.materials.appliance} fill sizes="(max-width: 900px) 100vw, 38vw"/><figcaption><span>{v.materials.appliance}</span><strong>{c.pricing.from} {formatRsd(extrasPrices.cabinets, locale)}</strong></figcaption></figure>
            </div>
            <div className="extras-ledger">{extraKeys.map((key, index) => <div key={key}><span>{String(index + 1).padStart(2, "0")}</span><strong>{c.calculator.labels[key]}</strong><small>{c.pricing.from} {formatRsd(extrasPrices[key], locale)}</small></div>)}</div>
          </div>
        </section>

        <section className="method-section" id="method">
          <div className="shell method-shell">
            <div className="method-copy"><div className="section-number light">{v.method.number}</div><h2>{v.method.title}</h2><p>{v.method.body}</p></div>
            <Image className="method-route" src="/media/floorplan-route.svg" alt="" width={1400} height={900}/>
            <ol className="method-steps">{c.process.steps.map((step) => <li key={step.number}><span>{step.number}</span><div><strong>{step.title}</strong><p>{step.text}</p></div></li>)}</ol>
          </div>
        </section>

        <section className="editorial-section evidence-section" id="terms">
          <div className="shell">
            <div className="section-number">{v.evidence.number}</div>
            <div className="evidence-grid"><div className="evidence-title"><h2>{v.evidence.title}</h2><p>{v.evidence.body}</p></div><figure><Image src="/media/material-textile.webp" alt="" width={1024} height={1024}/></figure></div>
            <div className="evidence-ledger">{c.assurance.items.map((item, index) => <article key={item.title}><span>{String(index + 1).padStart(2, "0")}</span><h3>{item.title}</h3><p>{item.text}</p></article>)}</div>
            <div className="service-boundaries">
              <strong>{c.assurance.unavailable}</strong>
              <ul>{c.assurance.unavailableItems.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          </div>
        </section>

        <section className="editorial-section site-faq-section" id="faq">
          <div className="shell">
            <div className="section-number">{v.faq.number}</div>
            <div className="section-intro split-intro"><h2>{v.faq.title}</h2><p>{v.faq.body}</p></div>
            <div className="site-faq-list">
              {c.faq.items.map((item, index) => (
                <details key={item.q} open={index === 0}>
                  <summary><span>{String(index + 1).padStart(2, "0")}</span><strong>{item.q}</strong><i aria-hidden="true">+</i></summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="estimate-section" id="estimate">
          <div className="shell">
            <div className="section-number">{v.estimate.number}</div>
            <div className="estimate-title"><h2>{v.estimate.title}</h2><p>{v.estimate.body}</p></div>
            <Estimate locale={locale} copy={v.estimate} content={c}/>
          </div>
        </section>

        <section className="closing-section"><div className="shell closing-grid"><div><div className="section-number light">{v.closing.number}</div><h2>{v.closing.title}</h2></div><div><p>{v.closing.body}</p><a className="site-closing-primary" href="#estimate">{v.closing.cta} ↗</a><div className="site-direct-contacts"><span>{v.closing.direct}</span><div>{messengerLinks.map((contact) => <a className="site-contact-link" href={contact.href} target={contact.id === "viber" ? undefined : "_blank"} rel={contact.id === "viber" ? undefined : "noreferrer"} key={contact.id}><small>{contact.label}</small><strong>{contact.value}</strong><i aria-hidden="true">↗</i></a>)}</div></div></div></div></section>
      </main>
      <footer className="site-footer"><div className="shell"><Image src="/brand/logo-primary.svg" alt="LumaClean" width={622} height={132}/><span>{v.footer}</span><div className="site-footer-locales">{(["ru", "sr", "en"] as Locale[]).map((item) => <Link className={item === locale ? "active" : ""} href={`/${item}`} key={item}>{item.toUpperCase()}</Link>)}</div></div></footer>
    </div>
  );
}
