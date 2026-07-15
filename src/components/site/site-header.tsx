"use client";

import Image from "next/image";
import Link from "next/link";
import {useEffect, useState} from "react";
import type {Locale} from "@/i18n/routing";
import type {EditorialContent} from "@/lib/site-content";

export function SiteHeader({locale, copy}: {locale: Locale; copy: EditorialContent["nav"]}) {
  const [paper, setPaper] = useState(false);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const handoff = document.querySelector<HTMLElement>("#handoff");
      if (!handoff) return;
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
      <a href="#top" className="proto-brand" aria-label="LumaClean">
        <Image src={paper ? "/brand/logo-primary.svg" : "/brand/logo-light.svg"} alt="LumaClean" width={622} height={132} priority />
      </a>
      <nav aria-label={copy.navLabel}>
        <a href="#scope">{copy.services}</a>
        <a href="#rates">{copy.prices}</a>
        <a href="#method">{copy.process}</a>
      </nav>
      <div className="site-header-actions">
        <div className="site-locales" role="navigation" aria-label={copy.languageLabel}>
          {(["ru", "sr", "en"] as Locale[]).map((item) => <Link className={item === locale ? "active" : ""} href={`/${item}`} key={item}>{item.toUpperCase()}</Link>)}
        </div>
        <a className="header-cta" href="#estimate"><b className="site-cta-long">{copy.cta}</b><b className="site-cta-short">{copy.shortCta}</b><i aria-hidden="true">↘</i></a>
      </div>
    </header>
  );
}
