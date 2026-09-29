import type {Locale} from "@/i18n/routing";
import type {ServiceId} from "@/lib/pricing";

export type ArticleTable = {caption: string; headings: string[]; rows: string[][]};
export type Section = {id: string; title: string; paragraphs: string[]; bullets?: string[]; tip?: string; table?: ArticleTable};
export type Translation = {slug: string; title: string; description: string; category: string; lead: string; imageAlt: string; sections: Section[]};
export type Article = {
  id: string;
  status: "draft" | "published";
  publishedAt?: string;
  updatedAt: string;
  image: string;
  services: ServiceId[];
  relatedIds?: string[];
  translations: Record<Locale, Translation>;
};
