import type {MetadataRoute} from "next";
import {routing} from "@/i18n/routing";
import {serviceIds} from "@/lib/pricing";
import {getServicePath} from "@/lib/seo-services";

import {siteUrl} from "@/lib/seo";
import {articleLanguages, articlePath, getPublishedArticles} from "@/lib/articles";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl;
  // Omit lastmod until each page has a maintained content modification date.
  const homeLanguages = {sr: `${base}/sr`, ru: `${base}/ru`, en: `${base}/en`, "x-default": `${base}/ru`};
  const homePages = routing.locales.map((locale) => ({url: `${base}/${locale}`, changeFrequency: "weekly" as const, priority: 1, alternates: {languages: homeLanguages}}));
  const servicePages = serviceIds.flatMap((service) => {
    const languages = {
      sr: `${base}${getServicePath("sr", service)}`,
      ru: `${base}${getServicePath("ru", service)}`,
      en: `${base}${getServicePath("en", service)}`,
      "x-default": `${base}${getServicePath("ru", service)}`,
    };
    return routing.locales.map((locale) => ({
      url: `${base}${getServicePath(locale, service)}`,
      lastModified: new Date(locale === "sr" && service === "regular" ? "2026-09-20" : "2026-09-16"),
      changeFrequency: "monthly" as const,
      priority: 0.9,
      alternates: {languages},
    }));
  });
  const published = getPublishedArticles();
  const absoluteLanguages = (languages: Record<string, string>) => Object.fromEntries(Object.entries(languages).map(([locale, path]) => [locale, base + path]));
  const articleIndexes = published.length ? routing.locales.map(locale => ({url: base + '/' + locale + '/articles', changeFrequency: 'weekly' as const, priority: 0.7, alternates: {languages: absoluteLanguages(articleLanguages())}})) : [];
  const articlePages = published.flatMap(article => routing.locales.map(locale => ({url: base + articlePath(article, locale), lastModified: new Date(article.updatedAt), changeFrequency: 'monthly' as const, priority: 0.7, alternates: {languages: absoluteLanguages(articleLanguages(article))}})));
  return [...homePages, ...servicePages, ...articleIndexes, ...articlePages];
}
