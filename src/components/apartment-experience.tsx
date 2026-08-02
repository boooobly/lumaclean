"use client";

import {ArrowDown, ArrowRight, MousePointer2} from "lucide-react";
import Image from "next/image";
import {useEffect, useRef, useState} from "react";
import type {Locale} from "@/i18n/routing";

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

type Direction = "forward" | "reverse";

const TOTAL_STEPS = 32;
const CHAPTER_STEPS = [0, 12, 20, TOTAL_STEPS] as const;
const SCRUB_CLIPS = [
  {start: 0, end: 12, file: "01"},
  {start: 12, end: 20, file: "02"},
  {start: 20, end: TOTAL_STEPS, file: "03"},
] as const;

type ScrollState = {
  step: number;
  chapter: number | null;
};

function mapScrollProgress(progress: number): ScrollState {
  const value = Math.max(0, Math.min(1, progress));

  if (value < 0.26) return {step: (value / 0.26) * CHAPTER_STEPS[1], chapter: null};
  if (value < 0.38) return {step: CHAPTER_STEPS[1], chapter: CHAPTER_STEPS[1]};
  if (value < 0.55) {
    const local = (value - 0.38) / (0.55 - 0.38);
    return {
      step: CHAPTER_STEPS[1] + local * (CHAPTER_STEPS[2] - CHAPTER_STEPS[1]),
      chapter: null,
    };
  }
  if (value < 0.66) return {step: CHAPTER_STEPS[2], chapter: CHAPTER_STEPS[2]};
  if (value < 0.91) {
    const local = (value - 0.66) / (0.91 - 0.66);
    return {
      step: CHAPTER_STEPS[2] + local * (CHAPTER_STEPS[3] - CHAPTER_STEPS[2]),
      chapter: null,
    };
  }
  return {step: TOTAL_STEPS, chapter: TOTAL_STEPS};
}

function getPhase(step: number) {
  if (step < CHAPTER_STEPS[1]) return 0;
  if (step < CHAPTER_STEPS[2]) return 1;
  if (step < CHAPTER_STEPS[3]) return 2;
  return 3;
}

function getScrubSource(index: number, mobile: boolean) {
  const folder = mobile ? "mobile" : "desktop";
  return `/media/journey-v5/${folder}/${SCRUB_CLIPS[index].file}.mp4`;
}

export function ApartmentExperience({locale, calculatorHref, finalFrameSrc}: {locale: Locale; calculatorHref: string; finalFrameSrc?: string}) {
  const track = useRef<HTMLElement>(null);
  const hero = useRef<HTMLDivElement>(null);
  const videos = useRef<Array<HTMLVideoElement | null>>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [activeChapter, setActiveChapter] = useState<number | null>(null);
  const [isSeeking, setIsSeeking] = useState(false);
  const text = copy[locale];
  const activePhase = getPhase(currentStep);
  const firstTransitionActive = currentStep > 0
    && currentStep < CHAPTER_STEPS[1]
    && activeChapter === null;

  useEffect(() => {
    const trackElement = track.current;
    const videoElements = videos.current.slice(0, SCRUB_CLIPS.length);
    if (!trackElement || videoElements.length !== SCRUB_CLIPS.length || videoElements.some((element) => !element)) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const abortController = new AbortController();
    const resolvedVideos = videoElements as HTMLVideoElement[];
    const mediaCleanups: Array<() => void> = [];
    const objectUrls: string[] = [];
    let step = 0;
    let requestedClip = 0;
    let activeClip = -1;
    let seekRevision = 0;
    let firstGesture = false;
    let renderedStep = 0;
    let targetStep = 0;
    let targetChapter: number | null = null;
    let lastDirection: Direction = "forward";
    let scrollProgress = 0;
    let scrollReadFrame = 0;
    let motionFrame = 0;
    let motionFrom = 0;
    let motionStarted = 0;
    let motionDuration = 140;
    let laidOutWidth = window.innerWidth;

    const isMobileVideo = () => window.innerWidth <= 680 && window.innerHeight >= window.innerWidth;

    type ClipState = {
      index: number;
      element: HTMLVideoElement;
      ready: boolean;
      desiredTime: number;
      revision: number;
    };
    const clipStates: ClipState[] = resolvedVideos.map((element, index) => ({
      index,
      element,
      ready: false,
      desiredTime: 0,
      revision: 0,
    }));

    const paintClip = (state: ClipState, revision: number) => {
      if (revision !== seekRevision || state.index !== requestedClip) return;
      resolvedVideos.forEach((element, index) => element.classList.toggle("is-active", index === state.index));
      activeClip = state.index;
      trackElement.classList.add("is-video-painted");
      trackElement.classList.remove("is-video-loading");
      setIsSeeking(false);
    };

    const revealOnPaint = (state: ClipState, revision: number) => {
      // `seeked` fires only after the requested frame is decoded. Switching the
      // opaque layer here avoids both a poster/video dissolve and the rVFC stall
      // browsers can produce for a fully transparent paused video.
      paintClip(state, revision);
    };

    const performSeek = (state: ClipState) => {
      if (!state.ready || state.index !== requestedClip || state.element.seeking) return;
      const target = state.desiredTime;
      const frameTolerance = 1 / 120;
      if (Math.abs(state.element.currentTime - target) <= frameTolerance) {
        revealOnPaint(state, state.revision);
        return;
      }
      try {
        state.element.currentTime = target;
      } catch {
        trackElement.classList.add("is-video-loading");
      }
    };

    const getClipPosition = (targetStep: number, direction: Direction) => {
      if (targetStep <= CHAPTER_STEPS[1]) {
        if (targetStep === CHAPTER_STEPS[1] && direction === "reverse") return {index: 1, local: 0};
        return {index: 0, local: targetStep / CHAPTER_STEPS[1]};
      }
      if (targetStep <= CHAPTER_STEPS[2]) {
        if (targetStep === CHAPTER_STEPS[2] && direction === "reverse") return {index: 2, local: 0};
        return {
          index: 1,
          local: (targetStep - CHAPTER_STEPS[1]) / (CHAPTER_STEPS[2] - CHAPTER_STEPS[1]),
        };
      }
      return {
        index: 2,
        local: (targetStep - CHAPTER_STEPS[2]) / (CHAPTER_STEPS[3] - CHAPTER_STEPS[2]),
      };
    };

    const seekToStep = (targetStep: number, direction: Direction, chapter: number | null) => {
      step = Math.max(0, Math.min(TOTAL_STEPS, targetStep));
      setCurrentStep(step);
      setActiveChapter(chapter);
      trackElement.classList.toggle("journey-started", step > 0);
      if (step < TOTAL_STEPS) trackElement.classList.remove("journey-handed-off");
      if (reducedMotion || step <= 0) {
        setIsSeeking(false);
        return;
      }

      const position = getClipPosition(step, direction);
      const state = clipStates[position.index];
      requestedClip = position.index;
      const duration = state.element.duration || 1;
      const lastFrameTime = Math.max(0, duration - 1 / 60);
      state.desiredTime = position.local >= 1
        ? lastFrameTime
        : Math.max(0, position.local * duration);
      state.revision = ++seekRevision;
      setIsSeeking(true);

      if (!state.ready) {
        trackElement.classList.add("is-video-loading");
        return;
      }
      trackElement.classList.remove("is-video-loading");
      performSeek(state);
    };

    const updateHandoff = () => {
      trackElement.classList.toggle(
        "journey-handed-off",
        scrollProgress >= 0.999 && renderedStep >= TOTAL_STEPS - 0.01,
      );
    };

    const renderMotion = (now: number) => {
      const progress = Math.max(0, Math.min(1, (now - motionStarted) / motionDuration));
      const eased = 1 - Math.pow(1 - progress, 3);
      renderedStep = motionFrom + (targetStep - motionFrom) * eased;
      seekToStep(renderedStep, lastDirection, progress >= 1 ? targetChapter : null);

      if (progress < 1) {
        motionFrame = requestAnimationFrame(renderMotion);
        return;
      }

      renderedStep = targetStep;
      motionFrame = 0;
      seekToStep(renderedStep, lastDirection, targetChapter);
      updateHandoff();
    };

    const setScrollTarget = (next: ScrollState) => {
      targetStep = Math.max(0, Math.min(TOTAL_STEPS, next.step));
      targetChapter = next.chapter;
      const distance = Math.abs(targetStep - renderedStep);

      if (distance < 0.0005) {
        renderedStep = targetStep;
        seekToStep(renderedStep, lastDirection, targetChapter);
        updateHandoff();
        return;
      }

      lastDirection = targetStep > renderedStep ? "forward" : "reverse";
      motionFrom = renderedStep;
      motionStarted = performance.now();
      motionDuration = Math.max(120, Math.min(180, 130 + distance * 20));
      if (!motionFrame) motionFrame = requestAnimationFrame(renderMotion);
    };

    const readScrollPosition = () => {
      scrollReadFrame = 0;
      const travel = Math.max(1, trackElement.offsetHeight - window.innerHeight);
      scrollProgress = Math.max(
        0,
        Math.min(1, (window.scrollY - trackElement.offsetTop) / travel),
      );
      if (scrollProgress < 0.999) trackElement.classList.remove("journey-handed-off");
      setScrollTarget(mapScrollProgress(scrollProgress));
    };

    const requestScrollRead = () => {
      if (!scrollReadFrame) scrollReadFrame = requestAnimationFrame(readScrollPosition);
    };

    const handleResize = () => {
      const widthChanged = window.innerWidth !== laidOutWidth;
      if (isMobileVideo() && !widthChanged) return;
      laidOutWidth = window.innerWidth;
      requestScrollRead();
    };

    const primeClip = (element: HTMLVideoElement) => {
      if (!/iPad|iPhone|iPod/.test(navigator.userAgent)) return;
      const promise = element.play();
      if (!promise) return;
      void promise.then(() => element.pause()).catch(() => undefined);
    };

    if (!reducedMotion) clipStates.forEach((state) => {
      const handleLoadedMetadata = () => {
        state.ready = true;
        state.element.pause();
        if (firstGesture) primeClip(state.element);
        if (state.index === requestedClip && step > 0) performSeek(state);
      };
      const handleSeeked = () => {
        if (state.index !== requestedClip) return;
        const frameTolerance = 1 / 120;
        if (Math.abs(state.element.currentTime - state.desiredTime) > frameTolerance) {
          performSeek(state);
          return;
        }
        revealOnPaint(state, state.revision);
      };
      const handleError = () => {
        if (state.index !== requestedClip) return;
        trackElement.classList.remove("is-video-loading");
        setIsSeeking(false);
        if (activeClip < 0) trackElement.classList.remove("is-video-painted");
      };

      state.element.addEventListener("loadedmetadata", handleLoadedMetadata);
      state.element.addEventListener("seeked", handleSeeked);
      state.element.addEventListener("error", handleError);
      mediaCleanups.push(() => {
        state.element.removeEventListener("loadedmetadata", handleLoadedMetadata);
        state.element.removeEventListener("seeked", handleSeeked);
        state.element.removeEventListener("error", handleError);
      });

      const source = getScrubSource(state.index, isMobileVideo());
      void fetch(source, {cache: "force-cache", signal: abortController.signal})
        .then((response) => {
          if (!response.ok) throw new Error(`Failed to load ${source}`);
          return response.blob();
        })
        .then((blob) => {
          if (abortController.signal.aborted) return;
          const objectUrl = URL.createObjectURL(blob);
          objectUrls.push(objectUrl);
          state.element.src = objectUrl;
          state.element.load();
        })
        .catch(() => {
          if (!abortController.signal.aborted) handleError();
        });
    });

    const handleFirstGesture = () => {
      if (firstGesture) return;
      firstGesture = true;
      clipStates.forEach((state) => state.ready && primeClip(state.element));
    };

    window.addEventListener("scroll", requestScrollRead, {passive: true});
    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", requestScrollRead);
    window.addEventListener("pointerdown", handleFirstGesture, {once: true, passive: true});
    window.addEventListener("touchstart", handleFirstGesture, {once: true, passive: true});
    readScrollPosition();

    return () => {
      abortController.abort();
      seekRevision += 1;
      if (scrollReadFrame) cancelAnimationFrame(scrollReadFrame);
      if (motionFrame) cancelAnimationFrame(motionFrame);
      trackElement.classList.remove("journey-started", "journey-handed-off", "is-transitioning", "is-video-painted", "is-video-loading");
      window.removeEventListener("scroll", requestScrollRead);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", requestScrollRead);
      window.removeEventListener("pointerdown", handleFirstGesture);
      window.removeEventListener("touchstart", handleFirstGesture);
      mediaCleanups.forEach((cleanup) => cleanup());
      resolvedVideos.forEach((element) => {
        element.pause();
        element.classList.remove("is-active");
        element.removeAttribute("src");
        element.load();
      });
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
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
          <Image className="journey-image journey-clean" src="/media/journey-v5/stills/000.webp" alt="" fill priority unoptimized sizes="100vw" />
          <Image className="journey-image journey-dirty" src="/media/journey-v5/stills/000-before.webp" alt="" fill loading="eager" unoptimized sizes="100vw" />
          <div className="journey-shade" />
        </div>

        <div className="journey-stage" aria-hidden="true">
          {SCRUB_CLIPS.map((clip, index) => (
            <video
              ref={(element) => {
                videos.current[index] = element;
              }}
              className="journey-video"
              preload="auto"
              muted
              playsInline
              disablePictureInPicture
              key={clip.file}
            />
          ))}
          <div className="journey-stage-stills">
            <Image
              className="journey-stage-image is-active"
              src="/media/journey-v5/stills/000.webp"
              alt=""
              fill
              sizes="100vw"
              unoptimized
              priority
            />
          </div>
          <div className="journey-video-vignette" />
          <div className="journey-loading-indicator" />
        </div>

        <aside className={`journey-chapter-intro${firstTransitionActive ? " is-active" : ""}`}>
          <span>{text.transitionEyebrow}</span>
          <h2>{text.transitionTitle}</h2>
        </aside>

        <aside className={`journey-infographic bathroom-infographic${activeChapter === CHAPTER_STEPS[1] && !isSeeking ? " is-active" : ""}`}>
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

        <aside className={`journey-infographic faucet-infographic${activeChapter === CHAPTER_STEPS[2] && !isSeeking ? " is-active" : ""}`}>
          <span className="infographic-eyebrow">{text.faucetEyebrow}</span>
          <h2>{text.faucetTitle}</h2>
          <p>{text.faucetBody}</p>
          <i className="infographic-focus-line" aria-hidden="true" />
        </aside>

        <aside className={`journey-infographic kitchen-infographic${activeChapter === CHAPTER_STEPS[3] && !isSeeking ? " is-active" : ""}`}>
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
          <div className="journey-phase-line"><i style={{transform: `scaleX(${currentStep / TOTAL_STEPS})`}} /></div>
          <div className="journey-phase-name">{text.phases[activePhase]}</div>
          <span className="journey-scroll-label">{text.scroll}</span>
        </div>
      </div>
    </section>
  );
}
