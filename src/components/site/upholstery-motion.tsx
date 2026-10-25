"use client";

import { useEffect } from "react";

const revealGroups = [
  ".up-section-heading > *", ".up-gallery-item", ".up-method-intro > *",
  ".up-steps li", ".up-price-table tbody tr", ".up-price-aside > *",
  ".up-price-notes > *", ".up-faq > div:first-child > *", ".up-faq details",
  ".up-closing .up-kicker, .up-closing-grid > *", ".up-footer > *",
];

/** Progressive enhancement: no pre-hidden content, scroll handlers or layout reads. */
export function UpholsteryMotion() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".upholstery-page");
    if (!root || !window.matchMedia || !("IntersectionObserver" in window) || !("animate" in Element.prototype)) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const animations = new Set<Animation>();
    let observer: IntersectionObserver | undefined;
    let stepObserver: IntersectionObserver | undefined;

    const stop = () => {
      observer?.disconnect();
      stepObserver?.disconnect();
      animations.forEach(animation => animation.cancel());
      animations.clear();
    };
    const start = () => {
      stop();
      if (preference.matches) return;
      const delays = new WeakMap<Element, number>();
      const easing = getComputedStyle(root).getPropertyValue("--lc-ease-out").trim() || "cubic-bezier(.22,1,.36,1)";
      try {
        observer = new IntersectionObserver(entries => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            observer?.unobserve(entry.target);
            try {
              const animation = entry.target.animate([
                { opacity: 0, transform: "translateY(12px)" },
                { opacity: 1, transform: "translateY(0)" },
              ], { duration: 560, delay: delays.get(entry.target) || 0, easing, fill: "backwards" });
              animations.add(animation);
              animation.finished.then(() => animations.delete(animation), () => animations.delete(animation));
            } catch { /* Content keeps its visible, server-rendered styles. */ }
          }
        }, { threshold: 0.08, rootMargin: "0px 0px -28px 0px" });
        for (const selector of revealGroups) {
          root.querySelectorAll(selector).forEach((element, index) => {
            delays.set(element, Math.min(index, 4) * 65);
            observer!.observe(element);
          });
        }
        const steps = root.querySelectorAll(".up-steps li");
        stepObserver = new IntersectionObserver(entries => {
          const visible = entries.filter(entry => entry.isIntersecting);
          if (!visible.length) return;
          const current = visible.reduce((a, b) => a.intersectionRatio > b.intersectionRatio ? a : b).target;
          steps.forEach(step => step.classList.toggle("is-current", step === current));
        }, { rootMargin: "-20% 0px -35% 0px", threshold: [0, 0.4, 0.8] });
        steps.forEach(step => stepObserver!.observe(step));
      } catch { stop(); }
    };
    start();
    preference.addEventListener("change", start);
    return () => { stop(); preference.removeEventListener("change", start); };
  }, []);
  return null;
}
