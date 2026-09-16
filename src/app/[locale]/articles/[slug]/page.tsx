import type {Metadata} from "next";
import Image from "next/image";
import Link from "next/link";
import {hasLocale} from "next-intl";
import {setRequestLocale} from "next-intl/server";
import {notFound} from "next/navigation";
import {routing, type Locale} from "@/i18n/routing";
import {SiteHeader} from "@/components/site/site-header";
import {ArticleCard, ArticleCta, ArticleFooter, PreviewNotice} from "@/components/site/article-components";
import {articleLanguages, articlePath, articleUi, articlesPreview, findArticle, getRelatedArticles, getVisibleArticles, readingMinutes} from "@/lib/articles";
import {editorialContent} from "@/lib/site-content";
import {siteContent} from "@/lib/content";
import {getServicePath} from "@/lib/seo-services";
import {siteUrl} from "@/lib/seo";

type Props = {params: Promise<{locale: string; slug: string}>};
export function generateStaticParams() {
  return routing.locales.flatMap(locale => getVisibleArticles().map(article => ({locale, slug: article.translations[locale].slug})));
}

async function resolveArticle(params: Props["params"]) {
  const {locale, slug} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const article = findArticle(locale, slug);
  if (!article) notFound();
  return {locale, article, t: article.translations[locale]};
}

export async function generateMetadata({params}: Props): Promise<Metadata> {
  const {locale, article, t} = await resolveArticle(params);
  const hidden = articlesPreview || article.status !== "published";
  return {title: `${t.title} | LumaClean`, description: t.description,
    robots: hidden ? {index: false, follow: true} : {index: true, follow: true},
    alternates: hidden ? undefined : {canonical: articlePath(article, locale), languages: articleLanguages(article)},
    openGraph: {title: t.title, description: t.description, type: "article", url: articlePath(article, locale), siteName: "LumaClean", locale: {ru: "ru_RU", sr: "sr_RS", en: "en_US"}[locale], images: [{url: article.image, width: 1536, height: 1024, alt: t.imageAlt}], publishedTime: article.publishedAt, modifiedTime: article.updatedAt},
    twitter: {card: "summary_large_image", title: t.title, description: t.description, images: [article.image]},
  };
}

export default async function ArticlePage({params}: Props) {
  const {locale, article, t} = await resolveArticle(params);
  setRequestLocale(locale);
  const ui = articleUi[locale];
  const pageUrl = `${siteUrl}${articlePath(article, locale)}`;
  const related = getRelatedArticles(article);
  const date = article.publishedAt ? (article.updatedAt > article.publishedAt ? article.updatedAt : article.publishedAt) : undefined;
  const dateLabel = article.publishedAt && article.updatedAt > article.publishedAt ? ui.updated : ui.published;
  const schema = {"@context": "https://schema.org", "@graph": [
    {"@type": "Article", "@id": `${pageUrl}#article`, headline: t.title, description: t.description, image: [`${siteUrl}${article.image}`], inLanguage: locale, mainEntityOfPage: pageUrl, datePublished: article.publishedAt, dateModified: article.updatedAt,
      author: {"@type": "Organization", name: "LumaClean", url: siteUrl}, publisher: {"@type": "Organization", name: "LumaClean", url: siteUrl}},
    {"@type": "BreadcrumbList", itemListElement: [
      {"@type": "ListItem", position: 1, name: ui.home, item: `${siteUrl}/${locale}`},
      {"@type": "ListItem", position: 2, name: ui.label, item: `${siteUrl}/${locale}/articles`},
      {"@type": "ListItem", position: 3, name: t.title, item: pageUrl},
    ]},
  ]};
  return <><SiteHeader locale={locale} copy={editorialContent[locale].nav} homeHref={`/${locale}`} estimateHref={`/${locale}#estimate`} localeHrefs={articleLanguages(article)} initialPaper />
    <main id="top" className="journal-main"><PreviewNotice locale={locale} />
      <nav className="journal-breadcrumbs" aria-label={ui.home}><Link href={`/${locale}`}>{ui.home}</Link><span aria-hidden="true">/</span><Link href={`/${locale}/articles`}>{ui.all}</Link><span aria-hidden="true">/</span><span aria-current="page">{t.category}</span></nav>
      <article>
        <header className="journal-article-heading"><div className="journal-meta"><span>{t.category}</span><span>{readingMinutes(article, locale)} {ui.minutes}</span>{article.status === "draft" && <span>{ui.draft}</span>}</div><h1>{t.title}</h1><p className="journal-lead">{t.lead}</p><div className="journal-byline"><span>LumaClean</span>{date && <span>{dateLabel} <time dateTime={date}>{new Intl.DateTimeFormat(locale, {day: "numeric", month: "long", year: "numeric", timeZone: "UTC"}).format(new Date(date))}</time></span>}</div></header>
        <figure className="journal-cover"><Image src={article.image} alt={t.imageAlt} width={1536} height={1024} preload sizes="(max-width: 760px) 100vw, 1200px" /><figcaption>{article.id === "prepare" && article.image.endsWith(".svg") ? ui.placeholder : ui.illustration}</figcaption></figure>
        <div className="journal-reading-layout"><aside className="journal-toc"><details open><summary>{ui.contents}</summary><ol>{t.sections.map(section => <li key={section.id}><a href={`#${section.id}`}>{section.title}</a></li>)}</ol></details><Link className="journal-toc-estimate" href={`/${locale}#estimate`}>{ui.cta} ↗</Link></aside>
          <div className="journal-prose">{t.sections.map(section => <section id={section.id} key={section.id}><h2>{section.title}</h2>{section.paragraphs.map(p => <p key={p}>{p}</p>)}{section.bullets && <ul>{section.bullets.map(item => <li key={item}>{item}</li>)}</ul>}{section.tip && <aside className="journal-tip"><strong>{ui.tip}</strong><p>{section.tip}</p></aside>}</section>)}
            <section className="journal-service-links"><h2>{ui.services}</h2>{article.services.map(service => <Link key={service} href={getServicePath(locale as Locale, service)}>{siteContent[locale].pricing.serviceNames[service]}<span aria-hidden="true">↗</span></Link>)}</section>
          </div>
        </div>
      </article>
      <ArticleCta locale={locale} />
      {related.length > 0 && <section className="journal-related"><div className="journal-section-heading"><h2>{ui.related}</h2><Link href={`/${locale}/articles`}>{ui.all} ↗</Link></div><div className="journal-grid">{related.map(other => <ArticleCard article={other} locale={locale} key={other.id} />)}</div></section>}
    </main><ArticleFooter locale={locale} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(schema).replace(/</g, "\\u003c")}} />
  </>;
}
