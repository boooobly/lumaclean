"use client";

import gsap from "gsap";
import {ScrollTrigger} from "gsap/ScrollTrigger";
import {ArrowDown, ArrowRight, MousePointer2} from "lucide-react";
import Image from "next/image";
import {useEffect, useRef, useState} from "react";
import type {Locale} from "@/i18n/routing";

gsap.registerPlugin(ScrollTrigger);

const copy = {
  sr: {
    eyebrow: "Čišćenje u celom Beogradu",
    title: "Čist prostor menja sve.",
    body: "Pređite mišem preko sobe i pogledajte kako je izgledala pre LumaClean čišćenja.",
    hover: "Pređite mišem preko sobe",
    touch: "Dodirnite i zadržite da vidite pre",
    scroll: "Skrolujte kroz prostor",
    primary: "Izračunajte cenu",
    secondary: "Zakažite čišćenje",
    phases: ["Dnevna soba", "Kupatilo", "Detalji", "Kuhinja"],
    transitionEyebrow: "Put kroz prostor",
    transitionTitle: "Sledeća stanica — kupatilo.",
    bathroomEyebrow: "02 · Kupatilo",
    bathroomTitle: "Čistoća se vidi u detaljima.",
    bathroomItems: [
      ["Ogledala bez tragova", "Uklanjamo prašinu, kapljice i otiske."],
      ["Fuge između pločica", "Obrađujemo mesta na kojima se skuplja prljavština."],
      ["Kamenac", "Čistimo naslage bez grubih ogrebotina."],
      ["Staklo i površine", "Uklanjamo tragove vode i sapuna."]
    ],
    faucetEyebrow: "Fokus na detaljima",
    faucetTitle: "Slavina bez kamenca.",
    faucetBody: "Metalne površine čistimo pažljivo, vraćajući im sjaj bez oštećenja.",
    kitchenEyebrow: "04 · Kuhinja",
    kitchenTitle: "Više od čistih površina.",
    kitchenItems: [
      ["Radne površine", "Odmašćivanje i pažljivo čišćenje radne zone."],
      ["Frontovi i ručke", "Uklanjamo otiske, prašinu i svakodnevne tragove."],
      ["Sudopera i slavina", "Čistoća bez kamenca i tragova vode."]
    ]
  },
  ru: {
    eyebrow: "Уборка по всему Белграду",
    title: "Чистое пространство меняет всё.",
    body: "Наведите курсор на комнату и посмотрите, как она выглядела до уборки LumaClean.",
    hover: "Наведите на комнату",
    touch: "Нажмите и удерживайте, чтобы увидеть до",
    scroll: "Листайте, чтобы пройти по квартире",
    primary: "Рассчитать стоимость",
    secondary: "Заказать уборку",
    phases: ["Гостиная", "Ванная", "Детали", "Кухня"],
    transitionEyebrow: "Маршрут по пространству",
    transitionTitle: "Следующая зона — ванная.",
    bathroomEyebrow: "02 · Ванная",
    bathroomTitle: "Чистота видна в деталях.",
    bathroomItems: [
      ["Зеркала без разводов", "Удаляем капли, пыль и следы прикосновений."],
      ["Плиточные швы", "Прорабатываем места, где скапливается грязь."],
      ["Водный камень", "Очищаем известковый налёт без грубых царапин."],
      ["Стекло и поверхности", "Убираем следы воды и мыльный налёт."]
    ],
    faucetEyebrow: "Фокус на деталях",
    faucetTitle: "Смеситель без водного камня.",
    faucetBody: "Бережно очищаем металл и возвращаем ему блеск, не повреждая поверхность.",
    kitchenEyebrow: "04 · Кухня",
    kitchenTitle: "Больше, чем чистые поверхности.",
    kitchenItems: [
      ["Рабочие поверхности", "Обезжириваем и тщательно очищаем рабочую зону."],
      ["Фасады и фурнитура", "Убираем отпечатки, пыль и повседневные следы."],
      ["Мойка и смеситель", "Чистота без водного камня и разводов."]
    ]
  },
  en: {
    eyebrow: "Cleaning across Belgrade",
    title: "A clean space changes everything.",
    body: "Hover over the room to see how it looked before LumaClean.",
    hover: "Hover over the room",
    touch: "Touch and hold to see before",
    scroll: "Scroll through the apartment",
    primary: "Estimate the cost",
    secondary: "Book cleaning",
    phases: ["Living room", "Bathroom", "Details", "Kitchen"],
    transitionEyebrow: "A journey through the space",
    transitionTitle: "Next stop — the bathroom.",
    bathroomEyebrow: "02 · Bathroom",
    bathroomTitle: "Cleanliness lives in the details.",
    bathroomItems: [
      ["Streak-free mirrors", "We remove droplets, dust and fingerprints."],
      ["Tile grout", "We treat the places where dirt collects."],
      ["Limescale", "We remove deposits without rough scratches."],
      ["Glass and surfaces", "We clear water marks and soap residue."]
    ],
    faucetEyebrow: "Focus on details",
    faucetTitle: "A limescale-free fixture.",
    faucetBody: "Metal is cleaned carefully, restoring its shine without damaging the surface.",
    kitchenEyebrow: "04 · Kitchen",
    kitchenTitle: "More than clean surfaces.",
    kitchenItems: [
      ["Work surfaces", "Degreasing and detailed care of the work zone."],
      ["Fronts and handles", "Removing fingerprints, dust and everyday marks."],
      ["Sink and fixture", "A finish free from limescale and water marks."]
    ]
  }
} as const;

const VIDEO_START = 0.075;
const VIDEO_FRAME_RATE = 30;

function interpolate(from: number, to: number, progress: number) {
  return from + (to - from) * progress;
}

function mapVideoTime(progress: number, videoDuration: number) {
  const scale = videoDuration / 7.8;
  const bathroomTime = 2.95 * scale;
  const faucetTime = 4.55 * scale;
  const kitchenTime = Math.min(videoDuration - 0.08, 7.65 * scale);

  if (progress <= 0.25) return interpolate(0, bathroomTime, progress / 0.25);
  if (progress <= 0.43) return bathroomTime;
  if (progress <= 0.58) return interpolate(bathroomTime, faucetTime, (progress - 0.43) / 0.15);
  if (progress <= 0.73) return faucetTime;
  if (progress <= 0.95) return interpolate(faucetTime, kitchenTime, (progress - 0.73) / 0.22);
  return kitchenTime;
}

function getPhase(progress: number) {
  if (progress < 0.2) return 0;
  if (progress < 0.5) return 1;
  if (progress < 0.73) return 2;
  return 3;
}

export function ApartmentExperience({locale, calculatorHref, finalFrameSrc}: {locale: Locale; calculatorHref: string; finalFrameSrc?: string}) {
  const track = useRef<HTMLElement>(null);
  const hero = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const targetTime = useRef(0);
  const duration = useRef(7.8);
  const seekInFlight = useRef(false);
  const animationFrame = useRef<number | null>(null);
  const activePhaseRef = useRef(0);
  const [activePhase, setActivePhase] = useState(0);
  const text = copy[locale];

  useEffect(() => {
    const trackElement = track.current;
    if (!trackElement) return;
    const videoElement = video.current;

    const releaseSeek = () => {
      seekInFlight.current = false;
    };

    videoElement?.addEventListener("seeked", releaseSeek);

    const renderVideo = () => {
      const element = video.current;
      if (element && element.readyState >= HTMLMediaElement.HAVE_METADATA) {
        const lastFrame = Math.max(0, Math.floor(duration.current * VIDEO_FRAME_RATE) - 1);
        const targetFrame = Math.max(0, Math.min(lastFrame, Math.round(targetTime.current * VIDEO_FRAME_RATE)));
        const currentFrame = Math.max(0, Math.round(element.currentTime * VIDEO_FRAME_RATE));

        if (!seekInFlight.current && !element.seeking && targetFrame !== currentFrame) {
          seekInFlight.current = true;
          element.currentTime = Math.min(duration.current - 0.001, targetFrame / VIDEO_FRAME_RATE);
        }
      }
      animationFrame.current = requestAnimationFrame(renderVideo);
    };

    animationFrame.current = requestAnimationFrame(renderVideo);

    const context = gsap.context(() => {
      const timelineClock = {progress: 0};
      const timeline = gsap.timeline({
        scrollTrigger: {
          trigger: track.current,
          start: "top top",
          end: "bottom bottom",
          scrub: true,
          invalidateOnRefresh: true,
          onUpdate: ({progress}) => {
            if (finalFrameSrc) trackElement.classList.toggle("journey-handed-off", progress >= 0.999);
            const videoProgress = Math.max(0, Math.min(1, (progress - VIDEO_START) / (1 - VIDEO_START)));
            targetTime.current = mapVideoTime(videoProgress, duration.current);

            const nextPhase = getPhase(videoProgress);
            if (nextPhase !== activePhaseRef.current) {
              activePhaseRef.current = nextPhase;
              setActivePhase(nextPhase);
            }
          }
        }
      });

      timeline
        .to(timelineClock, {progress: 1, duration: 1, ease: "none"}, 0)
        .to(".journey-copy", {autoAlpha: 0, yPercent: -18, duration: 0.045, ease: "power1.in"}, 0)
        .to(".journey-hover-hint", {autoAlpha: 0, duration: 0.025}, 0)
        .to(".journey-video-shell", {autoAlpha: 1, duration: 0.045, ease: "none"}, 0.025)
        .to(".journey-hero", {autoAlpha: 0, duration: 0.045, ease: "none"}, 0.045)
        .fromTo(".journey-progress", {autoAlpha: 0}, {autoAlpha: 1, duration: 0.04}, 0.07)
        .fromTo(".journey-chapter-intro", {autoAlpha: 0, y: 24}, {autoAlpha: 1, y: 0, duration: 0.035}, 0.105)
        .to(".journey-chapter-intro", {autoAlpha: 0, y: -22, duration: 0.03}, 0.275)
        .fromTo(".bathroom-infographic", {autoAlpha: 0}, {autoAlpha: 1, duration: 0.03}, 0.285)
        .fromTo(".bathroom-infographic .infographic-item", {autoAlpha: 0, y: 18}, {autoAlpha: 1, y: 0, duration: 0.04, stagger: 0.014}, 0.3)
        .to(".bathroom-infographic", {autoAlpha: 0, y: -18, duration: 0.03}, 0.535)
        .fromTo(".faucet-infographic", {autoAlpha: 0, x: 32}, {autoAlpha: 1, x: 0, duration: 0.04}, 0.57)
        .to(".faucet-infographic", {autoAlpha: 0, x: -24, duration: 0.03}, 0.76)
        .fromTo(".kitchen-infographic", {autoAlpha: 0, y: 22}, {autoAlpha: 1, y: 0, duration: 0.04}, 0.84)
        .fromTo(".kitchen-feature", {autoAlpha: 0, y: 14}, {autoAlpha: 1, y: 0, duration: 0.035, stagger: 0.012}, 0.855);

      if (finalFrameSrc) {
        timeline
          .to(".kitchen-infographic", {autoAlpha: 0, y: -14, duration: 0.026, ease: "power1.in"}, 0.945)
          .fromTo(".journey-final-kitchen", {autoAlpha: 0}, {autoAlpha: 1, duration: 0.032, ease: "power1.inOut"}, 0.946)
          .to(".journey-progress", {autoAlpha: 0, duration: 0.018}, 0.978);
      }
    }, trackElement);

    return () => {
      trackElement.classList.remove("journey-handed-off");
      context.revert();
      videoElement?.removeEventListener("seeked", releaseSeek);
      seekInFlight.current = false;
      if (animationFrame.current) cancelAnimationFrame(animationFrame.current);
    };
  }, [finalFrameSrc]);

  function revealBefore(show: boolean) {
    hero.current?.classList.toggle("is-before", show);
  }

  return (
    <section ref={track} className="journey-track" aria-label={text.scroll}>
      <div className="journey-sticky">
        <div
          ref={hero}
          className="journey-hero"
          onPointerEnter={(event) => event.pointerType === "mouse" && revealBefore(true)}
          onPointerLeave={() => revealBefore(false)}
          onPointerDown={() => revealBefore(true)}
          onPointerUp={() => revealBefore(false)}
          onPointerCancel={() => revealBefore(false)}
        >
          <Image className="journey-image journey-clean" src="/media/living-room-clean.jpg" alt="" fill priority unoptimized placeholder="blur" blurDataURL="/media/living-room-preview.jpg" sizes="100vw" />
          <Image className="journey-image journey-dirty" src="/media/living-room-dirty.jpg" alt="" fill priority unoptimized sizes="100vw" />
          <div className="journey-shade" />
        </div>

        <div className="journey-video-shell" aria-hidden="true">
          <video
            ref={video}
            className="journey-video"
            poster="/media/apartment-journey-poster.jpg"
            preload="auto"
            muted
            playsInline
            onLoadedMetadata={(event) => {
              duration.current = event.currentTarget.duration || 7.8;
              event.currentTarget.pause();
              event.currentTarget.currentTime = 0.001;
              targetTime.current = 0;
              seekInFlight.current = false;
              ScrollTrigger.refresh();
            }}
          >
            <source
              src="/media/apartment-journey-mobile.mp4"
              media="(max-width: 680px) and (orientation: portrait)"
              type="video/mp4"
            />
            <source src="/media/apartment-journey.mp4" type="video/mp4" />
          </video>
          <div className="journey-video-vignette" />
        </div>

        {finalFrameSrc && (
          <div className="journey-final-kitchen" aria-hidden="true">
            <Image src={finalFrameSrc} alt="" fill sizes="100vw" />
          </div>
        )}

        <aside className="journey-chapter-intro">
          <span>{text.transitionEyebrow}</span>
          <h2>{text.transitionTitle}</h2>
        </aside>

        <aside className="journey-infographic bathroom-infographic">
          <span className="infographic-eyebrow">{text.bathroomEyebrow}</span>
          <h2>{text.bathroomTitle}</h2>
          <div className="infographic-list">
            {text.bathroomItems.map(([title, description], index) => (
              <div className="infographic-item" key={title}>
                <span>0{index + 1}</span>
                <div><strong>{title}</strong><small>{description}</small></div>
              </div>
            ))}
          </div>
        </aside>

        <aside className="journey-infographic faucet-infographic">
          <span className="infographic-eyebrow">{text.faucetEyebrow}</span>
          <h2>{text.faucetTitle}</h2>
          <p>{text.faucetBody}</p>
          <i className="infographic-focus-line" aria-hidden="true" />
        </aside>

        <aside className="journey-infographic kitchen-infographic">
          <span className="infographic-eyebrow">{text.kitchenEyebrow}</span>
          <h2>{text.kitchenTitle}</h2>
          <div className="kitchen-feature-grid">
            {text.kitchenItems.map(([title, description], index) => (
              <div className="kitchen-feature" key={title}>
                <span>0{index + 1}</span>
                <strong>{title}</strong>
                <small>{description}</small>
              </div>
            ))}
          </div>
        </aside>

        <div className="journey-copy">
          <span className="cinematic-kicker">{text.eyebrow}</span>
          <h1>{text.title}</h1>
          <p>{text.body}</p>
          <div className="cinematic-actions">
            <a className="button button-light" href={calculatorHref}>{text.primary}<ArrowRight size={16} /></a>
            <a className="cinematic-link" href={calculatorHref}>{text.secondary}<ArrowDown size={15} /></a>
          </div>
        </div>

        <div className="journey-hover-hint">
          <MousePointer2 size={15} />
          <span className="pointer-fine-copy">{text.hover}</span>
          <span className="pointer-coarse-copy">{text.touch}</span>
        </div>

        <div className="journey-progress" aria-live="polite">
          <div className="journey-phase-number">0{activePhase + 1}</div>
          <div className="journey-phase-line"><i style={{transform: `scaleX(${(activePhase + 1) / 4})`}} /></div>
          <div className="journey-phase-name">{text.phases[activePhase]}</div>
          <span className="journey-scroll-label">{text.scroll}</span>
        </div>
      </div>
    </section>
  );
}
