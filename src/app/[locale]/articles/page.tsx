import type {Metadata} from "next";
import Link from "next/link";
import {hasLocale} from "next-intl";
import {setRequestLocale} from "next-intl/server";
import {notFound} from "next/navigation";
import {routing, type Locale} from "@/i18n/routing";
import {SiteHeader} from "@/components/site/site-header";
import {ArticleCard, ArticleCta, ArticleFooter, PreviewNotice} from "@/components/site/article-components";
import {articleLanguages, articleUi, articlesPreview, getVisibleArticles} from "@/lib/articles";
import {editorialContent} from "@/lib/site-content";
import {siteUrl} from "@/lib/seo";

type Props = {params: Promise<{locale: string}>};
export async function generateMetadata({params}: Props): Promise<Metadata> {
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const ui = articleUi[locale];
  const hidden = articlesPreview || !getVisibleArticles().length;
  return {title: `${ui.label} — ${ui.title}`, description: ui.intro,
    robots: hidden ? {index: false, follow: true} : {index: true, follow: true},
    alternates: hidden ? undefined : {canonical: `/${locale}/articles`, languages: articleLanguages()},
    openGraph: {title: ui.label, description: ui.intro, type: "website", url: `/${locale}/articles`, siteName: "LumaClean"},
  };
}

export default async function ArticlesPage({params}: Props) {
  const {locale: raw} = await params;
  if (!hasLocale(routing.locales, raw)) notFound();
  const locale = raw as Locale;
  setRequestLocale(locale);
  const ui = articleUi[locale];
  const articles = getVisibleArticles();
  const schema = {"@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
    {"@type": "ListItem", position: 1, name: ui.home, item: `${siteUrl}/${locale}`},
    {"@type": "ListItem", position: 2, name: ui.label, item: `${siteUrl}/${locale}/articles`},
  ]};
  return <><SiteHeader locale={locale} copy={editorialContent[locale].nav} homeHref={`/${locale}`} estimateHref={`/${locale}#estimate`} localeHrefs={articleLanguages()} initialPaper />
    <main id="top" className="journal-main"><PreviewNotice locale={locale} />
      <nav className="journal-breadcrumbs" aria-label={ui.home}><Link href={`/${locale}`}>{ui.home}</Link><span aria-hidden="true">/</span><span aria-current="page">{ui.label}</span></nav>
      <header className="journal-intro"><div><p className="journal-eyebrow">{ui.label} <span aria-hidden="true">/ 01</span></p><h1>{ui.title}</h1></div><p className="journal-intro-text">{ui.intro}</p></header>
      {articles.length ? <div className="journal-grid">{articles.map((article, index) => <ArticleCard key={article.id} article={article} locale={locale} featured={index === 0} />)}</div> : <p className="journal-empty">{ui.empty}</p>}
      <ArticleCta locale={locale} />
    </main><ArticleFooter locale={locale} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(schema).replace(/</g, "\\u003c")}} />
  </>;
}
