import "server-only";
import type {Locale} from "@/i18n/routing";
import type {Article} from "./types";
import {regularDeep} from "./regular-deep";
import {moveIn} from "./move-in";
import {cost} from "./cost";
import {prepare} from "./prepare";
import {choose} from "./choose";
import {moveOut} from "./move-out";
import {windows} from "./windows";
import {airbnb} from "./airbnb";
import {frequency} from "./frequency";
import {kitchen} from "./kitchen";
import {office} from "./office";
import {duration} from "./duration";
import {petHair} from "./pet-hair";
import {bathroom} from "./bathroom";
import {sameDay} from "./same-day";

// Vercel production always wins over an accidentally retained local preview flag.
export const articlesPreview = process.env.VERCEL_ENV !== "production" && (
  process.env.VERCEL_ENV === "preview" || process.env.NODE_ENV === "development" ||
  (!process.env.VERCEL && process.env.ARTICLES_PREVIEW === "1")
);
const articles: Article[] = [sameDay, choose, moveOut, windows, airbnb, frequency, kitchen, office, duration, petHair, bathroom, regularDeep, moveIn, cost, prepare];

// Fail the build rather than publish ambiguous dates or overlapping URLs.
for (const article of articles) {
  if (articles.filter(a => a.id === article.id).length !== 1) throw new Error(`Duplicate article id: ${article.id}`);
  for (const id of article.relatedIds || []) {
    if (id === article.id || !articles.some(a => a.id === id)) throw new Error(`Invalid related article: ${article.id} -> ${id}`);
  }
  if (article.status === "published" && !article.publishedAt) throw new Error(`Missing publication date: ${article.id}`);
  for (const date of [article.updatedAt, article.publishedAt].filter(Boolean)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date!) || Number.isNaN(Date.parse(date!)) || new Date(date!).toISOString().slice(0, 10) !== date) throw new Error(`Invalid article date: ${article.id}`);
  }
  if (article.publishedAt && article.updatedAt < article.publishedAt) throw new Error(`Update precedes publication: ${article.id}`);
  for (const locale of ["ru", "sr", "en"] as const) {
    const content = article.translations[locale];
    if (articles.filter(a => a.translations[locale].slug === content.slug).length !== 1) throw new Error(`Duplicate article slug: ${content.slug}`);
    if (new Set(content.sections.map(s => s.id)).size !== content.sections.length) throw new Error(`Duplicate section: ${article.id}`);
  }
}

export function getPublishedArticles() { return articles.filter(article => article.status === "published"); }
export function getVisibleArticles() { return articlesPreview ? articles : getPublishedArticles(); }
export function getRelatedArticles(article: Article) {
  const visible = getVisibleArticles().filter(other => other.id !== article.id);
  const curated = (article.relatedIds || []).flatMap(id => visible.filter(other => other.id === id));
  const fallback = visible.filter(other => !curated.includes(other)).sort((a, b) => Number(b.services.some(s => article.services.includes(s))) - Number(a.services.some(s => article.services.includes(s))));
  return [...curated, ...fallback].slice(0, 3);
}
const serviceReading: Record<string, string[]> = {
  regular: ["frequency", "regular-deep", "cost"],
  deep: ["regular-deep", "bathroom", "kitchen"],
  move: ["move-in", "move-out", "prepare"],
  airbnb: ["airbnb", "prepare", "duration"],
  office: ["office", "choose", "prepare"],
};
export function getServiceArticles(service: string) {
  return (serviceReading[service] || []).flatMap(id => getVisibleArticles().filter(article => article.id === id));
}
export function findArticle(locale: Locale, slug: string) { return getVisibleArticles().find(article => article.translations[locale].slug === slug); }
export function articlePath(article: Article, locale: Locale) { return `/${locale}/articles/${article.translations[locale].slug}`; }
export function articleLanguages(article?: Article) {
  const path = (locale: Locale) => article ? articlePath(article, locale) : `/${locale}/articles`;
  return {ru: path("ru"), sr: path("sr"), en: path("en"), "x-default": path("ru")};
}
export function readingMinutes(article: Article, locale: Locale) {
  const t = article.translations[locale];
  const words = [t.lead, ...t.sections.flatMap(s => [s.title, ...s.paragraphs, ...(s.bullets || []), s.tip || "", s.table?.caption || "", ...(s.table?.headings || []), ...(s.table?.rows.flat() || [])])].join(" ").split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 180));
}

export const articleUi = {
  ru: {home: "Главная", label: "Журнал LumaClean", title: "Полезное об уборке", intro: "Понятные советы об уборке и переезде в Белграде. Чтобы выбрать нужную услугу, подготовить квартиру и спокойно заняться своими делами.", all: "Все статьи", read: "Читать статью", minutes: "мин чтения", contents: "В этой статье", tip: "На заметку", related: "Ещё полезное", services: "Подходящие услуги", ctaTitle: "А уборку можно доверить нам.", ctaText: "Расскажите о квартире и нужных работах. Согласуем объём и стоимость перед визитом.", cta: "Рассчитать стоимость", draft: "Черновик · только для проверки", preview: "Превью · материалы закрыты от индексации", illustration: "Концептуальная иллюстрация, созданная с помощью ИИ. Не фотография выполненной уборки.", placeholder: "Временная редакционная иллюстрация. Обложка ожидает генерации.", empty: "Готовим первые материалы. Пока можно посмотреть услуги и рассчитать уборку.", updated: "Обновлено", published: "Опубликовано", footer: "Забота о вашем доме в Белграде"},
  sr: {home: "Početna", label: "LumaClean vodiči", title: "Saveti za čišćenje", intro: "Praktični saveti o čišćenju i selidbi u Beogradu. Izaberite uslugu, pripremite stan i posvetite vreme svojim planovima.", all: "Svi članci", read: "Pročitajte članak", minutes: "min čitanja", contents: "U ovom članku", tip: "Koristan savet", related: "Još korisnih saveta", services: "Odgovarajuće usluge", ctaTitle: "Čišćenje prepustite nama.", ctaText: "Opišite stan i potrebne poslove. Obim i cenu dogovaramo pre dolaska.", cta: "Procenite cenu", draft: "Nacrt · samo za pregled", preview: "Pregled · indeksiranje isključeno", illustration: "Konceptualna ilustracija napravljena uz pomoć AI. Nije fotografija obavljenog čišćenja.", placeholder: "Privremena urednička ilustracija. Naslovna slika čeka generisanje.", empty: "Pripremamo prve članke. Do tada pogledajte usluge i procenite cenu čišćenja.", updated: "Ažurirano", published: "Objavljeno", footer: "Briga o vašem domu u Beogradu"},
  en: {home: "Home", label: "The LumaClean journal", title: "Practical cleaning guides", intro: "Practical guides to cleaning and moving in Belgrade. Choose the right service, prepare your apartment and get on with your day.", all: "All articles", read: "Read article", minutes: "min read", contents: "In this article", tip: "A useful note", related: "More useful reading", services: "Services for your home", ctaTitle: "Leave the cleaning to us.", ctaText: "Tell us about the apartment and what you need. We agree the scope and price before the visit.", cta: "Get an estimate", draft: "Draft · for review only", preview: "Preview · indexing disabled", illustration: "Conceptual illustration created with AI. Not a photograph of a completed cleaning job.", placeholder: "Temporary editorial illustration. Cover generation is pending.", empty: "Our first guides are on their way. Meanwhile, explore the services and estimate your cleaning cost.", updated: "Updated", published: "Published", footer: "Care for your home in Belgrade"},
} as const;
