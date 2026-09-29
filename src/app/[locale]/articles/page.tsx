import type {Metadata} from "next";
import Link from "next/link";
import {hasLocale} from "next-intl";
import {setRequestLocale} from "next-intl/server";
import {notFound} from "next/navigation";
import {routing, type Locale} from "@/i18n/routing";
import {SiteHeader} from "@/components/site/site-header";
import {ArticleCard, ArticleCta, ArticleFooter, PreviewNotice} from "@/components/site/article-components";
import {articleLanguages, articlePath, articleUi, articlesPreview, getVisibleArticles} from "@/lib/articles";
import {readingPaths, readingPathsUi} from "@/lib/articles/reading-paths";
import {editorialContent} from "@/lib/site-content";
import {siteUrl} from "@/lib/seo";

type Props = {params: Promise<{locale: string}>};
export async function generateMetadata({params}: Props): Promise<Metadata> {
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const ui = articleUi[locale];
  const hidden = articlesPreview || !getVisibleArticles().length;
  const shareImage = getVisibleArticles()[0]?.image || "/media/articles/cost.webp";
  return {title: `${ui.label} — ${ui.title}`, description: ui.intro,
    robots: hidden ? {index: false, follow: true} : {index: true, follow: true},
    alternates: hidden ? undefined : {canonical: `/${locale}/articles`, languages: articleLanguages()},
    openGraph: {title: ui.label, description: ui.intro, type: "website", url: `/${locale}/articles`, siteName: "LumaClean", locale: {ru: "ru_RU", sr: "sr_RS", en: "en_US"}[locale], images: [{url: shareImage, width: 1536, height: 1024}]},
    twitter: {card: "summary_large_image", title: ui.label, description: ui.intro, images: [shareImage]},
  };
}

export default async function ArticlesPage({params}: Props) {
  const {locale: raw} = await params;
  if (!hasLocale(routing.locales, raw)) notFound();
  const locale = raw as Locale;
  setRequestLocale(locale);
  const ui = articleUi[locale];
  const articles = getVisibleArticles();
  const schema = {"@context": "https://schema.org", "@graph": [
    {"@type": "CollectionPage", "@id": `${siteUrl}/${locale}/articles#collection`, url: `${siteUrl}/${locale}/articles`, name: ui.title, description: ui.intro, inLanguage: locale,
      mainEntity: {"@type": "ItemList", itemListElement: articles.map((article, index) => ({"@type": "ListItem", position: index + 1, name: article.translations[locale].title, url: siteUrl + articlePath(article, locale)}))}},
    {"@type": "BreadcrumbList", itemListElement: [
    {"@type": "ListItem", position: 1, name: ui.home, item: `${siteUrl}/${locale}`},
    {"@type": "ListItem", position: 2, name: ui.label, item: `${siteUrl}/${locale}/articles`},
  ]}]};
  return <><SiteHeader locale={locale} copy={editorialContent[locale].nav} homeHref={`/${locale}`} estimateHref={`/${locale}#estimate`} localeHrefs={articleLanguages()} initialPaper />
    <main id="top" className="journal-main"><PreviewNotice locale={locale} />
      <nav className="journal-breadcrumbs" aria-label={ui.home}><Link href={`/${locale}`}>{ui.home}</Link><span aria-hidden="true">/</span><span aria-current="page">{ui.label}</span></nav>
      <header className="journal-intro"><div><p className="journal-eyebrow">{ui.label} <span aria-hidden="true">/ 01</span></p><h1>{ui.title}</h1></div><p className="journal-intro-text">{ui.intro}</p></header>
      {articles.length ? <>
        <section className="journal-paths" aria-labelledby="journal-paths-title">
          <h2 id="journal-paths-title">{readingPathsUi[locale].title}</h2>
          <div className="journal-paths-grid">{readingPaths.map(path => {
            const guides = path.ids.flatMap(id => articles.filter(article => article.id === id));
            return guides.length ? <div className="journal-path" key={path.ids[0]}><h3>{path.copy[locale].title}</h3><p>{path.copy[locale].text}</p><ul>{guides.map(article => <li key={article.id}><Link href={articlePath(article, locale)}>{article.translations[locale].title}</Link></li>)}</ul></div> : null;
          })}</div>
        </section>
        <section aria-labelledby="journal-all-title"><h2 id="journal-all-title" className="journal-all-title">{readingPathsUi[locale].all}</h2><div className="journal-grid">{articles.map((article, index) => <ArticleCard key={article.id} article={article} locale={locale} featured={index === 0} />)}</div></section>
      </> : <p className="journal-empty">{ui.empty}</p>}
      <ArticleCta locale={locale} />
    </main><ArticleFooter locale={locale} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(schema).replace(/</g, "\\u003c")}} />
  </>;
}
