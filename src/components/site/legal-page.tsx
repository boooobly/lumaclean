import type {Metadata} from "next";
import Image from "next/image";
import Link from "next/link";
import {hasLocale} from "next-intl";
import {setRequestLocale} from "next-intl/server";
import {notFound} from "next/navigation";
import {routing, type Locale} from "@/i18n/routing";
import {businessContact, whatsappContact} from "@/lib/contacts";
import {legalContent} from "@/lib/legal-content";
import "./legal-page.css";

type Kind = "privacy-policy" | "data-deletion";
export async function legalMetadata(params: Promise<{locale: string}>, kind: Kind): Promise<Metadata> {
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const copy = legalContent[locale];
  return {title: `${kind === "privacy-policy" ? copy.privacy : copy.deletion} | LumaClean`, description: kind === "privacy-policy" ? copy.privacyIntro : copy.deletionIntro,
    alternates: {canonical: `/${locale}/${kind}`, languages: {...Object.fromEntries(routing.locales.map(l => [l, `/${l}/${kind}`])), "x-default": `/en/${kind}`}}};
}

export async function LegalPage({params, kind}: {params: Promise<{locale: string}>; kind: Kind}) {
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const copy = legalContent[locale];
  return <div className="legal-page">
    <header className="legal-header"><Link href={`/${locale}`} aria-label="LumaClean"><Image src="/brand/logo-primary.svg" alt="LumaClean" width={210} height={45} priority/></Link>
      <nav aria-label="Language">{routing.locales.map((l: Locale) => <Link key={l} href={`/${l}/${kind}`} hrefLang={l} aria-current={l === locale ? "page" : undefined}>{l.toUpperCase()}</Link>)}</nav></header>
    <main id="main-content"><p className="legal-kicker">LUMACLEAN · BELGRADE</p><h1>{kind === "privacy-policy" ? copy.privacy : copy.deletion}</h1><p className="legal-updated">{copy.updated}</p>
      <p className="legal-intro">{kind === "privacy-policy" ? copy.privacyIntro : copy.deletionIntro}</p>
      {(kind === "privacy-policy" ? copy.sections : copy.steps).map(s => <section key={s.title}><h2>{s.title}</h2><p>{s.text}</p></section>)}
      <section id="contact"><h2>{copy.contact}</h2><p><a href={`https://wa.me/${whatsappContact.telephone.slice(1)}`}>WhatsApp: {whatsappContact.displayTelephone}</a><br/><a href={`tel:${businessContact.telephone}`}>{businessContact.displayTelephone}</a></p>
        <p><Link href={`/${locale}/${kind === "privacy-policy" ? "data-deletion" : "privacy-policy"}`}>{kind === "privacy-policy" ? copy.deletion : copy.privacy}</Link></p></section>
    </main><footer><Link href={`/${locale}`}>{copy.home}</Link><span>LumaClean · Belgrade, Serbia</span></footer>
  </div>;
}
