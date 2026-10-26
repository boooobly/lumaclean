import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Onest, Golos_Text } from "next/font/google";
import { routing } from "@/i18n/routing";
import {
  upholsteryPath,
  upholsterySlugs,
  upholsteryUi,
} from "@/lib/upholstery-content";
import { upholsteryPublicPrice } from "@/lib/upholstery";
import { formatRsd } from "@/lib/pricing";
import { getUpholsteryCatalog } from "@/lib/services/upholstery-catalog";
import { SiteHeader } from "@/components/site/site-header";
import { editorialContent } from "@/lib/site-content";
import {enquiryCopy} from '@/lib/lead-intent';
import { upholsteryPremiumCopy } from "@/lib/upholstery-premium-content";
import { UpholsteryGallery, UpholsteryCalculator } from "@/components/site/upholstery-calculator";
import { UpholsteryPhotoButton } from "@/components/site/upholstery-photo-button";
import { UpholsteryMotion } from "@/components/site/upholstery-motion";
import { ArrowIcon } from "@/components/site/arrow-icon";
import { siteUrl } from "@/lib/seo";
import { articlePath, getPublishedArticles } from "@/lib/articles";
import "../site.css";
import "@/components/site/upholstery.css";
import "@/components/site/upholstery-premium.css";
const display = Onest({
  subsets: ["latin", "cyrillic"],
  variable: "--font-lc-display",
  display: "swap",
});
const text = Golos_Text({
  subsets: ["latin", "cyrillic"],
  variable: "--font-lc-text",
  display: "swap",
});
type Props = { params: Promise<{ locale: string; upholstery: string }> };
async function resolve(params: Props["params"]) {
  const p = await params;
  if (
    !hasLocale(routing.locales, p.locale) ||
    p.upholstery !== upholsterySlugs[p.locale]
  )
    notFound();
  return p.locale;
}
const languages = {
  sr: upholsteryPath("sr"),
  ru: upholsteryPath("ru"),
  en: upholsteryPath("en"),
  "x-default": upholsteryPath("ru"),
};
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await resolve(params),
    u = upholsteryUi[locale];
  return {
    title: u.title,
    description: u.description,
    alternates: { canonical: upholsteryPath(locale), languages },
    robots: { index: true, follow: true },
    openGraph: {
      title: u.title,
      description: u.description,
      url: upholsteryPath(locale),
      type: "website",
      locale: { ru: "ru_RU", sr: "sr_RS", en: "en_US" }[locale],
      siteName: "LumaClean",
      images: [{ url: "/media/upholstery/sofa.webp", alt: upholsteryPremiumCopy[locale].heroAlt }],
    },
  };
}
export default async function Page({ params }: Props) {
  const locale = await resolve(params);
  setRequestLocale(locale);
  const u = upholsteryUi[locale],
    p = upholsteryPremiumCopy[locale],
    { catalog, version } = await getUpholsteryCatalog(),
    article = getPublishedArticles().find((a) => a.id === "upholstery");
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        name: u.name,
        serviceType: "Wet spray extraction upholstery cleaning",
        areaServed: { "@type": "City", name: "Belgrade" },
        provider: { "@type": "Organization", name: "LumaClean", url: siteUrl },
        url: siteUrl + upholsteryPath(locale),
      },
      {
        "@type": "FAQPage",
        mainEntity: u.faq.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };
  return (
    <div
      className={`site-page upholstery-page ${display.variable} ${text.variable}`}
    >
      <UpholsteryMotion />
      <SiteHeader
        locale={locale}
        copy={editorialContent[locale].nav}
        homeHref={`/${locale}`}
        estimateHref="#estimate"
        localeHrefs={languages}
        initialPaper
      />
      <main id="top">
        <header className="up-hero up-shell">
          <div className="up-hero-copy">
            <p className="up-kicker"><span />{p.eyebrow}</p>
            <h1 aria-label={u.h1}>{p.hero.map((line, i) => <span key={line} className={i === 2 ? "up-accent" : undefined}>{line}</span>)}</h1>
            <p className="up-hero-intro">{p.intro}</p>
            <div className="up-actions"><a className="up-button" href="#estimate">{u.quote}<ArrowIcon direction="down-right" /></a><UpholsteryPhotoButton locale={locale} /></div>
            <div className="up-hero-price"><span>{p.sofaNote}</span><strong>{u.from} {formatRsd(catalog.sofa3Normal, locale)}</strong></div>
          </div>
          <figure className="up-hero-visual">
            <Image src="/media/upholstery/sofa.webp" alt={p.heroAlt} fill preload sizes="(max-width: 680px) 100vw, (max-width: 1024px) 50vw, 55vw" />
            <figcaption><span>01 / LUMACLEAN</span><span>TEXTILE CARE</span></figcaption>
            <a className="up-image-link" href="#furniture" aria-label={p.galleryTitle.replace("\n", " ")}><ArrowIcon direction="down" /></a>
          </figure>
        </header>
        <div className="up-facts up-shell">{p.facts.map((fact, i) => <div key={fact}><span aria-hidden="true">0{i + 1}</span>{fact}</div>)}</div>

        <section className="up-section up-shell" id="furniture" aria-labelledby="up-gallery-title">
          <div className="up-section-heading"><div><p className="up-kicker">01 / {u.name}</p><h2 id="up-gallery-title">{p.galleryTitle}</h2></div><p>{p.galleryIntro}</p></div>
          <UpholsteryGallery locale={locale} prices={[catalog.sofa2, upholsteryPublicPrice(catalog, "cornerSeat"), catalog.armchair, catalog.chair, catalog.spot]} />
        </section>

        <section className="up-method" id="process" aria-labelledby="up-method-title"><div className="up-shell up-method-grid">
          <div className="up-method-intro"><p className="up-kicker">02 / {p.methodLabel}</p><h2 id="up-method-title">{p.methodTitle}</h2><p>{p.methodIntro}</p><div className="up-textile"><Image src="/media/material-textile.webp" alt={p.galleryAlts[4]} fill sizes="(max-width: 680px) 90vw, 33vw" /><span>KÄRCHER · {u.name}</span></div></div>
          <ol className="up-steps">{p.steps.map(([title, body], i) => <li key={title}><span>0{i + 1}</span><div><h3>{title}</h3><p>{body}</p></div><ArrowIcon direction="down-right" /></li>)}</ol>
        </div></section>

        <section className="up-section up-shell" id="prices" aria-labelledby="up-prices-title">
          <div className="up-section-heading"><div><p className="up-kicker">03 / {p.pricesLabel}</p><h2 id="up-prices-title">{p.pricesTitle}</h2></div><p>{p.pricesIntro}</p></div>
          <div className="up-pricing-grid"><div>
            <table className="up-price-table"><caption className="up-sr-only">{u.prices} · RSD</caption><thead><tr><th scope="col">{u.item}</th><th scope="col">RSD</th></tr></thead><tbody>{(["sofa2", "sofa3Normal", "cornerSeat", "armchair", "chair", "spot"] as const).map((key, i) => <tr key={key}><th scope="row"><span aria-hidden="true">0{i + 1}</span>{key === "cornerSeat" ? u.cornerBaseLabel : u.catalogLabels[key]}</th><td><small>{u.from}</small> {formatRsd(upholsteryPublicPrice(catalog, key), locale)}</td></tr>)}</tbody></table>
            <p className="up-price-extra"><span>{p.extraSeat}</span><strong>+ {formatRsd(catalog.cornerSeat, locale)}</strong></p>
            <p className="up-form-note">{p.deliveryNote}</p>
          </div><aside className="up-price-aside"><div className="up-minimum"><ArrowIcon direction="down-right" /><p>{u.minimum}</p><strong>{formatRsd(catalog.minimumVisit, locale)}</strong><small>{p.minimumNote}</small></div><div className="up-combined"><h3>{p.combinedTitle}</h3><p>{p.combinedNote}</p><a href="#estimate">{u.quote}<ArrowIcon direction="down-right" /></a></div></aside></div>
          <div className="up-price-notes"><p>{p.heavyNote}</p><p>{enquiryCopy[locale].otherItems}</p></div>
        </section>

        <section className="up-estimate-section" id="estimate" aria-labelledby="up-estimate-title"><div className="up-shell">
          <div className="up-section-heading"><div><p className="up-kicker">04 / {p.calculatorLabel}</p><h2 id="up-estimate-title">{p.calculatorTitle}</h2></div><p>{p.calculatorIntro}</p></div>
          <UpholsteryCalculator locale={locale} catalog={catalog} version={version} />
        </div></section>

        <section className="up-section up-shell up-faq" aria-labelledby="up-faq-title"><div><p className="up-kicker">05 / {p.faqLabel}</p><h2 id="up-faq-title">{p.faqTitle}</h2>{article && <Link className="up-text-link" href={articlePath(article, locale)}>{u.readArticle}<ArrowIcon direction="down-right" /></Link>}</div><div>
          <details><summary>{u.limitsTitle}<span aria-hidden="true">+</span></summary><div>{u.limits.map(line => <p key={line}>{line}</p>)}</div></details>
          <details><summary>{locale === "ru" ? "Что включено в стоимость?" : locale === "sr" ? "Šta je uključeno u cenu?" : "What is included in the price?"}<span aria-hidden="true">+</span></summary><ul>{u.included.map(line => <li key={line}>{line}</li>)}</ul></details>
          {u.faq.map(f => <details key={f.q}><summary>{f.q}<span aria-hidden="true">+</span></summary><p>{f.a}</p></details>)}
        </div></section>
        <section className="up-closing"><div className="up-shell"><p className="up-kicker">LUMACLEAN · BEOGRAD</p><div className="up-closing-grid"><h2>{p.closeTitle}</h2><div><p>{p.closeNote}</p><div className="up-actions"><a className="up-button" href="#estimate">{u.quote}<ArrowIcon direction="up-right" /></a><UpholsteryPhotoButton locale={locale} /></div></div></div></div></section>
      </main>
      <footer className="up-footer up-shell">
        <Link href={`/${locale}`}>LumaClean · Beograd</Link><Link href={`/${locale}`}>{p.backHome}<ArrowIcon direction="up-right" /></Link><Link href={`/${locale}/privacy-policy`}>{p.privacy}</Link>
      </footer>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(schema).replace(/</g, "\\u003c"),
        }}
      />
    </div>
  );
}
