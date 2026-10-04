import {GoogleProfileLinks} from "@/components/site/google-profile-links";
import Image from "next/image";
import Link from "next/link";
import type {Locale} from "@/i18n/routing";
import {articlePath, articleUi, articlesPreview, readingMinutes} from "@/lib/articles";
import type {Article} from "@/lib/articles/types";
import {getMessengerLinks} from "@/lib/contacts";
import {ArrowIcon} from "@/components/site/arrow-icon";

export function ArticleCard({article, locale, featured = false}: {article: Article; locale: Locale; featured?: boolean}) {
  const t = article.translations[locale];
  const ui = articleUi[locale];
  return <article className={`journal-card ${featured ? "journal-card-featured" : ""}`}>
    <Link className="journal-card-link" href={articlePath(article, locale)}>
      <div className="journal-card-image"><Image src={article.image} alt={t.imageAlt} fill sizes={featured ? "(max-width: 760px) 100vw, 65vw" : "(max-width: 760px) 100vw, 33vw"} preload={featured} />{article.status === "draft" && <span className="journal-draft">{ui.draft}</span>}</div>
      <div className="journal-card-copy"><div className="journal-meta"><span>{t.category}</span><span>{readingMinutes(article, locale)} {ui.minutes}</span></div><h2>{t.title}</h2><p>{t.description}</p><span className="journal-read">{ui.read}<span aria-hidden="true"><ArrowIcon /></span></span></div>
    </Link>
  </article>;
}

export function ArticleCta({locale}: {locale: Locale}) {
  const ui = articleUi[locale];
  return <section className="journal-cta" aria-labelledby="journal-cta-title"><div><span className="journal-eyebrow">LumaClean · Belgrade</span><h2 id="journal-cta-title">{ui.ctaTitle}</h2><p>{ui.ctaText}</p></div><div className="journal-cta-actions"><Link className="journal-button" href={`/${locale}#estimate`}>{ui.cta}<span aria-hidden="true"><ArrowIcon /></span></Link><div className="journal-messengers">{getMessengerLinks(locale).map(link => <a key={link.id} href={link.href}>{link.label}</a>)}</div></div></section>;
}

export function ArticleFooter({locale}: {locale: Locale}) {
  const ui = articleUi[locale];
  return <footer className="journal-footer"><Link href={`/${locale}`}>LumaClean <span>© {new Date().getFullYear()}</span></Link><p>{ui.footer}</p><Link href={`/${locale}/articles`}>{ui.all}</Link><GoogleProfileLinks locale={locale}/></footer>;
}

export function PreviewNotice({locale}: {locale: Locale}) {
  return articlesPreview ? <div className="journal-preview" role="note">{articleUi[locale].preview}</div> : null;
}
