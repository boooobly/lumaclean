import type {MetadataRoute} from "next";
import {routing} from "@/i18n/routing";
import {serviceIds} from "@/lib/pricing";
import {getServicePath} from "@/lib/seo-services";

import {siteUrl} from "@/lib/seo";
import {articleLanguages, articlePath, getPublishedArticles} from "@/lib/articles";

// The revised price bands affect all homepage and service price tables.
const pricingLastModified = new Date("2026-09-28");

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl;
  const homeLanguages = {sr: `${base}/sr`, ru: `${base}/ru`, en: `${base}/en`, "x-default": `${base}/ru`};
  const homePages = routing.locales.map((locale) => ({url: `${base}/${locale}`, lastModified: pricingLastModified, changeFrequency: "weekly" as const, priority: 1, alternates: {languages: homeLanguages}}));
  const servicePages = serviceIds.flatMap((service) => {
    const languages = {
      sr: `${base}${getServicePath("sr", service)}`,
      ru: `${base}${getServicePath("ru", service)}`,
      en: `${base}${getServicePath("en", service)}`,
      "x-default": `${base}${getServicePath("ru", service)}`,
    };
    return routing.locales.map((locale) => ({
      url: `${base}${getServicePath(locale, service)}`,
      lastModified: pricingLastModified,
      changeFrequency: "monthly" as const,
      priority: 0.9,
      alternates: {languages},
    }));
  });
  const published = getPublishedArticles();
  const absoluteLanguages = (languages: Record<string, string>) => Object.fromEntries(Object.entries(languages).map(([locale, path]) => [locale, base + path]));
  const journalLastModified = new Date(Math.max(Date.parse("2026-09-29"), ...published.map(article => Date.parse(article.updatedAt))));
  const articleIndexes = published.length ? routing.locales.map(locale => ({url: base + '/' + locale + '/articles', lastModified: journalLastModified, changeFrequency: 'weekly' as const, priority: 0.7, alternates: {languages: absoluteLanguages(articleLanguages())}})) : [];
  const articlePages = published.flatMap(article => routing.locales.map(locale => ({url: base + articlePath(article, locale), lastModified: new Date(article.updatedAt), changeFrequency: 'monthly' as const, priority: 0.7, alternates: {languages: absoluteLanguages(articleLanguages(article))}})));
  return [...homePages, ...servicePages, ...articleIndexes, ...articlePages];
}
