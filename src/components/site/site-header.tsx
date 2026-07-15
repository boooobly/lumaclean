"use client";

import Image from "next/image";
import Link from "next/link";
import {useEffect, useState} from "react";
import type {Locale} from "@/i18n/routing";
import type {EditorialContent} from "@/lib/site-content";

export function SiteHeader({locale, copy, homeHref = "", estimateHref = "#estimate", localeHrefs}: {
  locale: Locale;
  copy: EditorialContent["nav"];
  homeHref?: string;
  estimateHref?: string;
  localeHrefs?: Partial<Record<Locale, string>>;
}) {
  const [paper, setPaper] = useState(false);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const handoff = document.querySelector<HTMLElement>("#handoff");
      if (!handoff) {
        const serviceHero = document.querySelector<HTMLElement>(".service-hero");
        setPaper(serviceHero ? serviceHero.getBoundingClientRect().bottom <= 88 : true);
        return;
      }
      const rect = handoff.getBoundingClientRect();
      const travel = Math.max(1, handoff.offsetHeight - window.innerHeight);
      setPaper(-rect.top / travel > 0.18);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, {passive: true});
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <header className={`proto-header site-header ${paper ? "is-paper" : ""}`}>
      <a href={homeHref || "#top"} className="proto-brand" aria-label="LumaClean">
        <Image src={paper ? "/brand/logo-primary.svg" : "/brand/logo-light.svg"} alt="LumaClean" width={622} height={132} priority />
      </a>
      <nav aria-label={copy.navLabel}>
        <a href={`${homeHref}#scope`}>{copy.services}</a>
        <a href={`${homeHref}#rates`}>{copy.prices}</a>
        <a href={`${homeHref}#method`}>{copy.process}</a>
      </nav>
      <div className="site-header-actions">
        <div className="site-locales" role="navigation" aria-label={copy.languageLabel}>
          {(["ru", "sr", "en"] as Locale[]).map((item) => <Link className={item === locale ? "active" : ""} href={localeHrefs?.[item] || `/${item}`} key={item}>{item.toUpperCase()}</Link>)}
        </div>
        <a className="header-cta" href={estimateHref}><b className="site-cta-long">{copy.cta}</b><b className="site-cta-short">{copy.shortCta}</b><i aria-hidden="true">↘</i></a>
      </div>
    </header>
  );
}
