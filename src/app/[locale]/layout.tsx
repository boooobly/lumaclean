import type {Metadata} from "next";
import {Geist} from "next/font/google";
import {hasLocale} from "next-intl";
import {getTranslations, setRequestLocale} from "next-intl/server";
import {notFound} from "next/navigation";
import {routing} from "@/i18n/routing";
import "../globals.css";

const geist = Geist({subsets: ["latin", "cyrillic"], variable: "--font-geist"});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({locale}));
}

export async function generateMetadata({params}: {params: Promise<{locale: string}>}): Promise<Metadata> {
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({locale, namespace: "Metadata"});
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://lumacleanrs.com";
  const openGraphLocale = {ru: "ru_RU", sr: "sr_RS", en: "en_US"}[locale];
  return {
    metadataBase: new URL(base),
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical: `/${locale}`,
      languages: {sr: "/sr", ru: "/ru", en: "/en", "x-default": "/ru"},
    },
    openGraph: {title: t("title"), description: t("description"), type: "website", locale: openGraphLocale, siteName: "LumaClean", url: `/${locale}`, images: [{url: "/media/apartment-journey-poster.jpg", width: 1280, height: 720, alt: "LumaClean — cleaning in Belgrade"}]},
    twitter: {card: "summary_large_image", title: t("title"), description: t("description"), images: ["/media/apartment-journey-poster.jpg"]},
    robots: {index: true, follow: true},
    verification: {
      google:
        process.env.GOOGLE_SITE_VERIFICATION ||
        "zgG5SSwresZFL8dIqWx9S52oIR8Y9GwLhS4mDAQ9tGQ",
      yandex: process.env.YANDEX_SITE_VERIFICATION || undefined,
    },
    other: {"geo.region": "RS-00", "geo.placename": "Belgrade"},
  };
}

export default async function LocaleLayout({children, params}: {children: React.ReactNode; params: Promise<{locale: string}>}) {
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return (
    <html lang={locale} className={geist.variable}>
      <body>{children}</body>
    </html>
  );
}
