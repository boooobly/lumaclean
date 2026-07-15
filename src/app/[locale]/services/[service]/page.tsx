import type {Metadata} from "next";
import Image from "next/image";
import Link from "next/link";
import {Golos_Text, Onest} from "next/font/google";
import {hasLocale} from "next-intl";
import {setRequestLocale} from "next-intl/server";
import {notFound} from "next/navigation";
import {Estimate} from "@/components/site/estimate";
import {SiteHeader} from "@/components/site/site-header";
import {routing, type Locale} from "@/i18n/routing";
import {getMessengerLinks} from "@/lib/contacts";
import {siteContent} from "@/lib/content";
import {formatRsd, priceMatrix, serviceIds} from "@/lib/pricing";
import {findServiceBySlug, getServicePath, servicePageUi, serviceSeoContent} from "@/lib/seo-services";
import {editorialContent} from "@/lib/site-content";
import "../../site.css";
import "./service.css";

const displayFont = Onest({subsets: ["latin", "cyrillic"], variable: "--font-lc-display", display: "swap"});
const textFont = Golos_Text({subsets: ["latin", "cyrillic"], variable: "--font-lc-text", display: "swap"});

type Params = {locale: string; service: string};

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => serviceIds.map((service) => ({locale, service: serviceSeoContent[locale][service].slug})));
}

export async function generateMetadata({params}: {params: Promise<Params>}): Promise<Metadata> {
  const {locale: rawLocale, service: slug} = await params;
  if (!hasLocale(routing.locales, rawLocale)) notFound();
  const locale = rawLocale as Locale;
  const match = findServiceBySlug(locale, slug);
  if (!match) notFound();
  const content = match.content;
  const localeNames = {ru: "ru_RU", sr: "sr_RS", en: "en_US"} as const;
  return {
    title: content.title,
    description: content.description,
    alternates: {
      canonical: getServicePath(locale, match.id),
      languages: {
        ru: getServicePath("ru", match.id),
        sr: getServicePath("sr", match.id),
        en: getServicePath("en", match.id),
        "x-default": getServicePath("ru", match.id),
      },
    },
    openGraph: {
      title: content.title,
      description: content.description,
      type: "website",
      locale: localeNames[locale],
      siteName: "LumaClean",
      url: getServicePath(locale, match.id),
      images: [{url: content.image, alt: content.imageAlt}],
    },
    twitter: {card: "summary_large_image", title: content.title, description: content.description, images: [content.image]},
    robots: {index: true, follow: true},
  };
}

export default async function ServicePage({params}: {params: Promise<Params>}) {
  const {locale: rawLocale, service: slug} = await params;
  if (!hasLocale(routing.locales, rawLocale)) notFound();
  const locale = rawLocale as Locale;
  const match = findServiceBySlug(locale, slug);
  if (!match) notFound();
  setRequestLocale(locale);

  const {id, content} = match;
  const ui = servicePageUi[locale];
  const pageContent = siteContent[locale];
  const editorial = editorialContent[locale];
  const messengerLinks = getMessengerLinks(locale);
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://lumacleanrs.com").replace(/\/$/, "");
  const pageUrl = `${siteUrl}${getServicePath(locale, id)}`;
  const localeHrefs = Object.fromEntries(routing.locales.map((item) => [item, getServicePath(item, id)])) as Record<Locale, string>;
  const related = serviceIds.filter((serviceId) => serviceId !== id);
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {"@type": "ListItem", position: 1, name: ui.home, item: `${siteUrl}/${locale}`},
          {"@type": "ListItem", position: 2, name: ui.services, item: `${siteUrl}/${locale}#scope`},
          {"@type": "ListItem", position: 3, name: content.h1, item: pageUrl},
        ],
      },
      {
        "@type": "Service",
        "@id": `${pageUrl}#service`,
        name: content.h1,
        description: content.description,
        serviceType: pageContent.pricing.serviceNames[id],
        url: pageUrl,
        image: `${siteUrl}${content.image}`,
        areaServed: {"@type": "City", name: "Belgrade", containedInPlace: {"@type": "Country", name: "Serbia"}},
        provider: {"@type": "Organization", "@id": `${siteUrl}/#organization`, name: "LumaClean", url: siteUrl, logo: `${siteUrl}/brand/logo-primary.svg`},
        offers: {"@type": "Offer", price: priceMatrix[id][0], priceCurrency: "RSD", url: pageUrl, availability: "https://schema.org/InStock"},
      },
      {
        "@type": "FAQPage",
        mainEntity: content.faq.map((item) => ({"@type": "Question", name: item.q, acceptedAnswer: {"@type": "Answer", text: item.a}})),
      },
    ],
  };

  return (
    <div id="top" className={`site-page service-page ${displayFont.variable} ${textFont.variable}`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(schema).replace(/</g, "\\u003c")}}/>
      <SiteHeader locale={locale} copy={editorial.nav} homeHref={`/${locale}`} estimateHref="#estimate" localeHrefs={localeHrefs}/>
      <main>
        <section className="service-hero">
          <Image src={content.image} alt={content.imageAlt} fill priority sizes="100vw"/>
          <div className="service-hero-shade"/>
          <div className="shell service-hero-shell">
            <nav className="service-breadcrumbs" aria-label="Breadcrumb">
              <Link href={`/${locale}`}>{ui.home}</Link><span>/</span><Link href={`/${locale}#scope`}>{ui.services}</Link><span>/</span><b>{pageContent.pricing.serviceNames[id]}</b>
            </nav>
            <div className="service-hero-copy">
              <span>{content.eyebrow}</span>
              <h1>{content.h1}</h1>
              <p>{content.lead}</p>
              <div className="service-hero-actions"><a href="#estimate">{ui.estimate}<i>↘</i></a><small>{ui.allBelgrade}</small></div>
            </div>
          </div>
        </section>

        <section className="service-overview">
          <div className="shell service-overview-grid">
            <div className="service-overview-index">01 · {ui.services}</div>
            <div className="service-overview-copy">{content.intro.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
            <aside className="service-price-card"><span>{ui.priceFrom}</span><strong>{formatRsd(priceMatrix[id][0], locale)}</strong><p>{ui.priceNote}</p><a href="#estimate">{ui.estimate} ↘</a></aside>
          </div>
        </section>

        <section className="service-scope">
          <div className="shell">
            <div className="section-number">02 · {ui.included}</div>
            <div className="service-section-heading"><h2>{ui.included}</h2><p>{ui.includedLead}</p></div>
            <ol className="service-included-list">{content.included.map((item, index) => <li key={item}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item}</strong></li>)}</ol>
            <div className="service-suitable"><h3>{ui.suitable}</h3><ul>{content.suitable.map((item) => <li key={item}>{item}</li>)}</ul></div>
          </div>
        </section>

        <section className="service-details">
          <div className="shell">
            <div className="section-number light">03 · {ui.details}</div>
            <div className="service-detail-grid">{content.details.map((item, index) => <article key={item.title}><span>0{index + 1}</span><h2>{item.title}</h2><p>{item.text}</p></article>)}</div>
          </div>
        </section>

        <section className="service-process">
          <div className="shell">
            <div className="section-number">04 · {ui.process}</div>
            <div className="service-section-heading"><h2>{ui.process}</h2><p>{pageContent.process.title}</p></div>
            <ol>{pageContent.process.steps.map((step) => <li key={step.number}><span>{step.number}</span><div><strong>{step.title}</strong><p>{step.text}</p></div></li>)}</ol>
          </div>
        </section>

        <section className="service-faq">
          <div className="shell">
            <div className="section-number">05 · FAQ</div>
            <div className="service-section-heading"><h2>{ui.faq}</h2><p>{content.description}</p></div>
            <div className="site-faq-list">{content.faq.map((item, index) => <details key={item.q} open={index === 0}><summary><span>{String(index + 1).padStart(2, "0")}</span><strong>{item.q}</strong><i aria-hidden="true">+</i></summary><p>{item.a}</p></details>)}</div>
          </div>
        </section>

        <section className="service-related">
          <div className="shell">
            <div className="section-number light">06 · {ui.related}</div>
            <h2>{ui.related}</h2>
            <nav aria-label={ui.navLabel}>{related.map((serviceId, index) => <Link href={getServicePath(locale, serviceId)} key={serviceId}><span>{String(index + 1).padStart(2, "0")}</span><strong>{pageContent.pricing.serviceNames[serviceId]}</strong><i>↗</i></Link>)}</nav>
          </div>
        </section>

        <section className="estimate-section" id="estimate">
          <div className="shell">
            <div className="section-number">07 · {editorial.estimate.number.replace(/^\d+\s*·\s*/, "")}</div>
            <div className="estimate-title"><h2>{editorial.estimate.title}</h2><p>{editorial.estimate.body}</p></div>
            <Estimate locale={locale} copy={editorial.estimate} content={pageContent} initialService={id}/>
          </div>
        </section>
      </main>
      <footer className="site-footer"><div className="shell"><Link href={`/${locale}`}><Image src="/brand/logo-primary.svg" alt="LumaClean" width={622} height={132}/></Link><span>{editorial.footer}</span><div className="site-footer-locales">{routing.locales.map((item) => <Link className={item === locale ? "active" : ""} href={localeHrefs[item]} key={item}>{item.toUpperCase()}</Link>)}</div><div className="service-footer-contacts">{messengerLinks.map((contact) => <a href={contact.href} key={contact.id} target={contact.id === "viber" ? undefined : "_blank"} rel={contact.id === "viber" ? undefined : "noreferrer"}>{contact.label}</a>)}</div></div></footer>
    </div>
  );
}
