"use client";

import Image from "next/image";
import {useEffect, useRef} from "react";
import type {EditorialContent} from "@/lib/site-content";

export function JourneyHandoff({copy}: {copy: EditorialContent["handoff"]}) {
  const sectionRef = useRef<HTMLElement>(null);
  const kitchenRef = useRef<HTMLElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const routeRef = useRef<HTMLImageElement>(null);
  const noteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frame = 0;
    const render = () => {
      frame = 0;
      const section = sectionRef.current;
      if (!section) return;
      const rect = section.getBoundingClientRect();
      const max = Math.max(1, section.offsetHeight - window.innerHeight);
      const progress = Math.max(0, Math.min(1, -rect.top / max));
      const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      const reveal = Math.max(0, Math.min(1, (progress - 0.38) / 0.34));
      if (kitchenRef.current) kitchenRef.current.style.transform = `translate3d(${-eased * 19}vw,${-eased * 7}vh,0) scale(${1 - eased * 0.39})`;
      if (copyRef.current) {
        copyRef.current.style.opacity = String(reveal);
        copyRef.current.style.transform = `translateY(${(1 - reveal) * 30}px)`;
      }
      if (routeRef.current) routeRef.current.style.opacity = String(reveal * 0.22);
      if (noteRef.current) noteRef.current.style.opacity = String(1 - Math.min(1, progress * 4));
    };
    const requestRender = () => {
      if (!frame) frame = requestAnimationFrame(render);
    };
    render();
    window.addEventListener("scroll", requestRender, {passive: true});
    window.addEventListener("resize", requestRender);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", requestRender);
      window.removeEventListener("resize", requestRender);
    };
  }, []);

  return (
    <section ref={sectionRef} className="handoff" id="handoff">
      <div className="handoff-sticky">
        <div className="handoff-wash" />
        <figure ref={kitchenRef} className="kitchen-frame">
          <Image src="/media/kitchen-clean.webp" alt="" fill sizes="100vw" />
        </figure>
        <div ref={copyRef} className="handoff-copy">
          <span className="kicker">{copy.kicker}</span>
          <h1>{copy.title}</h1>
          <p>{copy.body}</p>
        </div>
        <Image ref={routeRef} className="handoff-route" src="/media/floorplan-route.svg" alt="" width={1400} height={900} />
        <div ref={noteRef} className="scroll-note">{copy.scroll}</div>
      </div>
    </section>
  );
}
