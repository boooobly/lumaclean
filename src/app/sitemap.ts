import type {MetadataRoute} from "next";
import {routing} from "@/i18n/routing";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://lumaclean.rs";
  return routing.locales.map((locale) => ({url: `${base}/${locale}`, lastModified: new Date(), changeFrequency: "monthly", priority: 1, alternates: {languages: {sr: `${base}/sr`, ru: `${base}/ru`, en: `${base}/en`}}}));
}
