import type {Metadata} from "next";
import {Geist} from "next/font/google";
import {hasLocale} from "next-intl";
import {setRequestLocale} from "next-intl/server";
import {notFound} from "next/navigation";
import {routing} from "@/i18n/routing";
import {siteUrl} from "@/lib/seo";
import {Analytics} from "@/components/site/analytics";
import {articlePath, getPublishedArticles} from "@/lib/articles";
import {getServicePath} from "@/lib/seo-services";
import {serviceIds} from "@/lib/pricing";
import "../globals.css";

const geist = Geist({subsets: ["latin", "cyrillic"], variable: "--font-geist"});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({locale}));
}

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || "zgG5SSwresZFL8dIqWx9S52oIR8Y9GwLhS4mDAQ9tGQ",
    yandex: process.env.YANDEX_SITE_VERIFICATION || undefined,
  },
};

export default async function LocaleLayout({children, params}: {children: React.ReactNode; params: Promise<{locale: string}>}) {
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return (
    <html lang={locale} className={geist.variable}>
      <body>{children}<Analytics locale={locale} enabled={process.env.VERCEL_ENV === "production"} measurementId={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || ""} paths={routing.locales.flatMap(l => [`/${l}`, `/${l}/articles`, ...serviceIds.map(s => getServicePath(l, s)), ...getPublishedArticles().map(a => articlePath(a, l))])}/></body>
    </html>
  );
}
