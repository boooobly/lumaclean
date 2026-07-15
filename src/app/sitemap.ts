import type {MetadataRoute} from "next";
import {routing} from "@/i18n/routing";
import {serviceIds} from "@/lib/pricing";
import {getServicePath} from "@/lib/seo-services";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://lumacleanrs.com").replace(/\/$/, "");
  const lastModified = new Date("2026-07-16");
  const homeLanguages = {sr: `${base}/sr`, ru: `${base}/ru`, en: `${base}/en`, "x-default": `${base}/ru`};
  const homePages = routing.locales.map((locale) => ({url: `${base}/${locale}`, lastModified, changeFrequency: "weekly" as const, priority: 1, alternates: {languages: homeLanguages}}));
  const servicePages = serviceIds.flatMap((service) => {
    const languages = {
      sr: `${base}${getServicePath("sr", service)}`,
      ru: `${base}${getServicePath("ru", service)}`,
      en: `${base}${getServicePath("en", service)}`,
      "x-default": `${base}${getServicePath("ru", service)}`,
    };
    return routing.locales.map((locale) => ({url: `${base}${getServicePath(locale, service)}`, lastModified, changeFrequency: "monthly" as const, priority: 0.9, alternates: {languages}}));
  });
  return [...homePages, ...servicePages];
}
