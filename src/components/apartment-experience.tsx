"use client";

import gsap from "gsap";
import {ScrollTrigger} from "gsap/ScrollTrigger";
import {ArrowDown, ArrowRight, MousePointer2, SkipForward} from "lucide-react";
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

type SequenceState = "idle" | "playing" | "complete";
type PauseId = "bathroom" | "faucet" | "kitchen";

const PAUSE_MARKERS: ReadonlyArray<{id: PauseId; time: number; hold: number; phase: number}> = [
  {id: "bathroom", time: 3.25, hold: 2400, phase: 1},
  {id: "faucet", time: 4.85, hold: 2200, phase: 2},
  {id: "kitchen", time: 7.55, hold: 2500, phase: 3},
];

const PAUSE_FRAMES: ReadonlyArray<{id: PauseId; src: string}> = [
  {id: "bathroom", src: "/media/journey-pause-bathroom.webp"},
  {id: "faucet", src: "/media/journey-pause-faucet.webp"},
  {id: "kitchen", src: "/media/journey-pause-kitchen.webp"},
];

const skipCopy: Record<Locale, string> = {
  sr: "Preskoči",
  ru: "Пропустить",
  en: "Skip",
};

const playbackCopy: Record<Locale, string> = {
  sr: "Automatski obilazak",
  ru: "Автоматический маршрут",
  en: "Automatic tour",
};

export function ApartmentExperience({locale, calculatorHref, finalFrameSrc}: {locale: Locale; calculatorHref: string; finalFrameSrc?: string}) {
  const track = useRef<HTMLElement>(null);
  const hero = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const finishSequenceRef = useRef<() => void>(() => undefined);
  const [sequenceState, setSequenceState] = useState<SequenceState>("idle");
  const [activeStop, setActiveStop] = useState<PauseId | null>(null);
  const [activePhase, setActivePhase] = useState(0);
  const text = copy[locale];

  useEffect(() => {
    const trackElement = track.current;
    if (!trackElement || !video.current) return;
    const videoElement = video.current;

    let preloadTimeout: ReturnType<typeof setTimeout> | undefined;
    let preloadIdle: number | undefined;
    let playbackFrame: number | undefined;
    let pauseTimeout: ReturnType<typeof setTimeout> | undefined;
    let resumeTimeout: ReturnType<typeof setTimeout> | undefined;
    let safetyTimeout: ReturnType<typeof setTimeout> | undefined;
    let markerIndex = 0;
    let hasStarted = false;
    let hasFinished = false;
    let scrollLocked = false;
    let disposed = false;

    const clearSequenceTimers = () => {
      if (playbackFrame) cancelAnimationFrame(playbackFrame);
      if (pauseTimeout) clearTimeout(pauseTimeout);
      if (resumeTimeout) clearTimeout(resumeTimeout);
      if (safetyTimeout) clearTimeout(safetyTimeout);
      playbackFrame = undefined;
      pauseTimeout = undefined;
      resumeTimeout = undefined;
      safetyTimeout = undefined;
    };

    const lockScroll = () => {
      if (scrollLocked) return;
      scrollLocked = true;
      document.documentElement.classList.add("journey-scroll-locked");
      document.body.classList.add("journey-scroll-locked");
    };

    const unlockScroll = () => {
      if (!scrollLocked) return;
      scrollLocked = false;
      document.documentElement.classList.remove("journey-scroll-locked");
      document.body.classList.remove("journey-scroll-locked");
    };

    const finishSequence = () => {
      if (hasFinished || disposed) return;
      hasFinished = true;
      clearSequenceTimers();
      videoElement.pause();
      setActiveStop(null);
      setActivePhase(3);
      setSequenceState("complete");

      resumeTimeout = setTimeout(() => {
        if (disposed) return;
        unlockScroll();
        const handoffTop = trackElement.offsetTop + trackElement.offsetHeight - window.innerHeight;
        const previousScrollBehavior = document.documentElement.style.scrollBehavior;
        document.documentElement.style.scrollBehavior = "auto";
        window.scrollTo({top: Math.max(0, handoffTop), behavior: "auto"});
        requestAnimationFrame(() => {
          document.documentElement.style.scrollBehavior = previousScrollBehavior;
        });
        ScrollTrigger.update();
      }, 90);
    };

    finishSequenceRef.current = finishSequence;

    const resumeVideo = async () => {
      if (hasFinished || disposed) return;
      try {
        await videoElement.play();
        playbackFrame = requestAnimationFrame(monitorPlayback);
      } catch {
        finishSequence();
      }
    };

    const pauseAtMarker = (marker: (typeof PAUSE_MARKERS)[number]) => {
      videoElement.pause();
      setActivePhase(marker.phase);
      setActiveStop(marker.id);

      pauseTimeout = setTimeout(() => {
        if (marker.id === "kitchen") {
          finishSequence();
          return;
        }

        setActiveStop(null);
        markerIndex += 1;
        resumeTimeout = setTimeout(() => void resumeVideo(), 320);
      }, marker.hold);
    };

    function monitorPlayback() {
      if (hasFinished || disposed) return;
      const marker = PAUSE_MARKERS[markerIndex];
      if (!marker || videoElement.ended) {
        finishSequence();
        return;
      }
      if (videoElement.currentTime >= marker.time - 1 / 60) {
        pauseAtMarker(marker);
        return;
      }
      playbackFrame = requestAnimationFrame(monitorPlayback);
    }

    const startSequence = async () => {
      if (hasStarted || hasFinished || disposed) return;
      hasStarted = true;
      markerIndex = 0;
      setActiveStop(null);
      setActivePhase(0);
      setSequenceState("playing");
      lockScroll();

      videoElement.pause();
      videoElement.playbackRate = 1;
      videoElement.currentTime = 0.001;
      safetyTimeout = setTimeout(finishSequence, 30000);
      await resumeVideo();
    };

    const resetSequence = () => {
      if (!hasFinished || disposed) return;
      clearSequenceTimers();
      unlockScroll();
      hasStarted = false;
      hasFinished = false;
      markerIndex = 0;
      videoElement.pause();
      videoElement.currentTime = 0.001;
      setActiveStop(null);
      setActivePhase(0);
      setSequenceState("idle");
    };

    const warmVideo = () => {
      const load = () => {
        if (videoElement.preload !== "auto") {
          videoElement.preload = "auto";
          videoElement.load();
        }
      };
      const requestIdle = typeof window.requestIdleCallback === "function" ? window.requestIdleCallback.bind(window) : null;
      if (requestIdle) preloadIdle = requestIdle(load, {timeout: 1200});
      else preloadTimeout = setTimeout(load, 400);
    };

    if (document.readyState === "complete") warmVideo();
    else window.addEventListener("load", warmVideo, {once: true});

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const trigger = reducedMotion.matches ? undefined : ScrollTrigger.create({
      trigger: trackElement,
      start: "top top-=2",
      end: "bottom bottom",
      onEnter: () => {
        const rect = trackElement.getBoundingClientRect();
        if (rect.top > -window.innerHeight * 0.35) void startSequence();
      },
      onLeaveBack: resetSequence,
    });

    const handleVideoError = () => finishSequence();
    videoElement.addEventListener("error", handleVideoError);

    return () => {
      disposed = true;
      trigger?.kill();
      videoElement.removeEventListener("error", handleVideoError);
      videoElement.pause();
      window.removeEventListener("load", warmVideo);
      if (preloadTimeout) clearTimeout(preloadTimeout);
      if (preloadIdle) window.cancelIdleCallback(preloadIdle);
      clearSequenceTimers();
      unlockScroll();
      finishSequenceRef.current = () => undefined;
    };
  }, []);

  function revealBefore(show: boolean) {
    hero.current?.classList.toggle("is-before", show);
  }

  return (
    <section ref={track} className={`journey-track journey-sequence-${sequenceState}`} aria-label={text.scroll}>
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
          <Image className="journey-image journey-clean" src="/media/living-room-clean.jpg" alt="" fill priority placeholder="blur" blurDataURL="/media/living-room-preview.jpg" sizes="100vw" />
          <Image className="journey-image journey-dirty" src="/media/living-room-dirty.jpg" alt="" fill loading="eager" sizes="100vw" />
          <div className="journey-shade" />
        </div>

        <div className="journey-video-shell" aria-hidden="true">
          <video
            ref={video}
            className="journey-video"
            poster="/media/apartment-journey-poster.jpg"
            preload="metadata"
            muted
            playsInline
            onLoadedMetadata={() => ScrollTrigger.refresh()}
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

        {PAUSE_FRAMES.map((frame) => (
          <div className={`journey-pause-frame ${activeStop === frame.id ? "is-active" : ""}`} aria-hidden="true" key={frame.id}>
            <Image src={frame.src} alt="" fill sizes="100vw" loading="eager" />
          </div>
        ))}

        {finalFrameSrc && (
          <div className={`journey-final-kitchen ${sequenceState === "complete" ? "is-active" : ""}`} aria-hidden="true">
            <Image src={finalFrameSrc} alt="" fill sizes="100vw" />
          </div>
        )}

        <aside className="journey-chapter-intro">
          <span>{text.transitionEyebrow}</span>
          <h2>{text.transitionTitle}</h2>
        </aside>

        <aside className={`journey-infographic bathroom-infographic ${activeStop === "bathroom" ? "is-active" : ""}`}>
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

        <aside className={`journey-infographic faucet-infographic ${activeStop === "faucet" ? "is-active" : ""}`}>
          <span className="infographic-eyebrow">{text.faucetEyebrow}</span>
          <h2>{text.faucetTitle}</h2>
          <p>{text.faucetBody}</p>
          <i className="infographic-focus-line" aria-hidden="true" />
        </aside>

        <aside className={`journey-infographic kitchen-infographic ${activeStop === "kitchen" ? "is-active" : ""}`}>
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

        <button className="journey-skip" type="button" onClick={() => finishSequenceRef.current()}>
          <span>{skipCopy[locale]}</span>
          <SkipForward size={14} aria-hidden="true" />
        </button>

        <div className="journey-progress" aria-live="polite">
          <div className="journey-phase-number">0{activePhase + 1}</div>
          <div className="journey-phase-line"><i style={{transform: `scaleX(${(activePhase + 1) / 4})`}} /></div>
          <div className="journey-phase-name">{text.phases[activePhase]}</div>
          <span className="journey-scroll-label">{playbackCopy[locale]}</span>
        </div>
      </div>
    </section>
  );
}
