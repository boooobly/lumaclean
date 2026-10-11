import type { Metadata } from "next";
import Link from "next/link";
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
import { upholsteryPriceKeys } from "@/lib/upholstery";
import { formatRsd } from "@/lib/pricing";
import { getUpholsteryCatalog } from "@/lib/services/upholstery-catalog";
import { SiteHeader } from "@/components/site/site-header";
import { editorialContent } from "@/lib/site-content";
import { UpholsteryCalculator } from "@/components/site/upholstery-calculator";
import { UpholsteryPhotoButton } from "@/components/site/upholstery-photo-button";
import { siteUrl } from "@/lib/seo";
import { articlePath, getPublishedArticles } from "@/lib/articles";
import "../site.css";
import "@/components/site/upholstery.css";
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
  "x-default": upholsteryPath("sr"),
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
      images: [{ url: "/media/material-textile.webp", alt: u.name }],
    },
  };
}
export default async function Page({ params }: Props) {
  const locale = await resolve(params);
  setRequestLocale(locale);
  const u = upholsteryUi[locale],
    { catalog } = await getUpholsteryCatalog(),
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
      <SiteHeader
        locale={locale}
        copy={editorialContent[locale].nav}
        homeHref={`/${locale}`}
        estimateHref="#estimate"
        localeHrefs={languages}
        initialPaper
      />
      <main className="upholstery-container">
        <header className="upholstery-hero">
          <p className="upholstery-eyebrow">{u.name} · Beograd · Kärcher</p>
          <h1>{u.h1}</h1>
          <p className="upholstery-lead">{u.lead}</p>
          <div className="upholstery-actions">
            <a className="upholstery-cta" href="#estimate">
              {u.estimate}
            </a>
            <UpholsteryPhotoButton locale={locale} />
          </div>
          <small>
            {u.from} {formatRsd(catalog.sofa3Light, locale)} · {u.minimum}:{" "}
            {formatRsd(catalog.minimumVisit, locale)}
          </small>
        </header>
        <section className="upholstery-section" id="prices">
          <h2>{u.prices}</h2>
          <table className="upholstery-prices">
            <thead>
              <tr>
                <th>{u.item}</th>
                <th>RSD</th>
              </tr>
            </thead>
            <tbody>
              {upholsteryPriceKeys.map((key) => (
                <tr key={key}>
                  <td>{u.catalogLabels[key]}</td>
                  <td>
                    {["spot", "sofa3Heavy"].includes(key) ? `${u.from} ` : ""}
                    {formatRsd(catalog[key], locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>{u.delivery}</p>
        </section>
        <section className="upholstery-section">
          <h2>{u.soil}</h2>
          <div className="upholstery-columns">
            {u.levels.map(([title, body]) => (
              <div key={title}>
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="upholstery-section">
          <div className="upholstery-columns">
            {u.situations.map(([title, body]) => (
              <div key={title}>
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="upholstery-section">
          <h2>
            {locale === "ru"
              ? "Что входит"
              : locale === "sr"
                ? "Šta je uključeno"
                : "What is included"}
          </h2>
          <ul>
            {u.included.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
        <section className="upholstery-section">
          <h2>{u.limitsTitle}</h2>
          {u.limits.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </section>
        <section className="upholstery-section upholstery-faq">
          <h2>FAQ</h2>
          {u.faq.map((f) => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
          {article && (
            <p>
              <Link href={articlePath(article, locale)}>{u.readArticle} →</Link>
            </p>
          )}
        </section>
        <section className="upholstery-section" id="estimate">
          <h2>{u.estimate}</h2>
          <UpholsteryCalculator locale={locale} />
        </section>
      </main>
      <footer className="upholstery-footer upholstery-container">
        <Link href={`/${locale}`}>LumaClean · Beograd</Link> ·{" "}
        <Link href={`/${locale}/privacy-policy`}>
          {locale === "ru"
            ? "Конфиденциальность"
            : locale === "sr"
              ? "Privatnost"
              : "Privacy"}
        </Link>
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
