"use client";

import {useEffect, useRef, useState} from 'react';

/** Presentation only: the accessible value always comes directly from pricing. */
export function AnimatedPrice({value, locale}: {value: number; locale: string}) {
  const element = useRef<HTMLSpanElement>(null);
  const displayed = useRef(value);
  const [initial] = useState(value);
  const formatter = new Intl.NumberFormat(locale === 'en' ? 'en-US' : locale === 'ru' ? 'ru-RU' : 'sr-Latn-RS');
  useEffect(() => {
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const format = new Intl.NumberFormat(locale === 'en' ? 'en-US' : locale === 'ru' ? 'ru-RU' : 'sr-Latn-RS');
    let frame = 0;
    const start = displayed.current;
    let started: number | undefined;
    const render = (number: number) => {
      displayed.current = number;
      if (element.current) element.current.textContent = format.format(Math.round(number));
    };
    const finish = () => { cancelAnimationFrame(frame); render(value); };
    const tick = (time: number) => {
      started ??= time;
      const progress = Math.min(1, (time - started) / 400);
      render(start + (value - start) * (1 - Math.pow(1 - progress, 3)));
      if (progress < 1) frame = requestAnimationFrame(tick);
      else render(value);
    };
    if (motion.matches) finish();
    else frame = requestAnimationFrame(tick);
    const changed = () => { if (motion.matches) finish(); };
    motion.addEventListener('change', changed);
    return () => { cancelAnimationFrame(frame); motion.removeEventListener('change', changed); };
  }, [value, locale]);
  return <span ref={element} aria-hidden="true" className="rate-amount">{formatter.format(initial)}</span>;
}
