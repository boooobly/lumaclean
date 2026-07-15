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
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://lumaclean.rs";
  return {
    metadataBase: new URL(base),
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical: `/${locale}`,
      languages: {sr: "/sr", ru: "/ru", en: "/en", "x-default": "/ru"},
    },
    openGraph: {title: t("title"), description: t("description"), type: "website", locale, siteName: "LumaClean", url: `/${locale}`},
    twitter: {card: "summary_large_image", title: t("title"), description: t("description")},
    robots: {index: true, follow: true},
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
