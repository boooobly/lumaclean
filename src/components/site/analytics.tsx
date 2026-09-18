"use client";

import Script from "next/script";
import {usePathname} from "next/navigation";
import {useEffect, useRef, useState, useSyncExternalStore} from "react";
import type {Locale} from "@/i18n/routing";
import {acquisitionContext, entrySource, entrySources, eventNames, safeEventData} from "@/lib/analytics";
import "./analytics.css";

const key = "lc-analytics-consent-v1";
let memoryConsent: "yes" | "no" | null = null;
function readConsent() { try { const saved = localStorage.getItem(key); if (saved === "yes" || saved === "no") return saved; } catch {} return memoryConsent; }
function subscribeConsent(onChange: () => void) { window.addEventListener("storage", onChange); window.addEventListener("lc-consent", onChange); return () => { window.removeEventListener("storage", onChange); window.removeEventListener("lc-consent", onChange); }; }
const serverConsent = () => null;
const clientReady = () => true;
const serverReady = () => false;
const subscribeReady = () => () => {};
const copy = {
  ru: {title: "Помочь нам улучшить сайт?", body: "С вашего разрешения Google Analytics измеряет посещения и обращения. Без согласия аналитика не загружается. На расчёт и отправку заявки ваш выбор не влияет.", accept: "Разрешить аналитику", deny: "Без аналитики", settings: "Настройки приватности", details: "Какие данные используются", detail: "Google получает сведения о посещённых страницах и действиях, технические данные устройства и IP-адрес при соединении. Для статистики используются cookies. Мы не передаём в аналитику имя, телефон, текст заявки, параметры URL и полные ссылки мессенджеров. Выбор можно изменить здесь в любое время. Данные формы получает менеджер LumaClean в Telegram для ответа и согласования уборки. По вопросам данных свяжитесь с менеджером через контакты сайта.", google: "Как Google использует данные", close: "Закрыть"},
  sr: {title: "Pomozite nam da poboljšamo sajt", body: "Uz vašu dozvolu Google Analytics meri posete i upite. Bez pristanka se ne učitava. Vaš izbor ne utiče na obračun cene ili slanje upita.", accept: "Dozvoli analitiku", deny: "Bez analitike", settings: "Podešavanja privatnosti", details: "Koji se podaci koriste", detail: "Google prima podatke o posećenim stranicama i radnjama, tehničke podatke uređaja i IP adresu pri povezivanju. Statistika koristi kolačiće. Ne šaljemo ime, telefon, tekst upita, URL parametre ili pune linkove aplikacija za poruke. Izbor možete promeniti ovde u svakom trenutku. Upit iz obrasca prima menadžer LumaClean u Telegramu radi odgovora i dogovora o čišćenju. Za pitanja o podacima obratite se menadžeru putem kontakata na sajtu.", google: "Kako Google koristi podatke", close: "Zatvori"},
  en: {title: "Help us improve the website?", body: "With your permission, Google Analytics measures visits and enquiries. It does not load without consent. Your choice does not affect estimates or enquiry forms.", accept: "Allow analytics", deny: "Without analytics", settings: "Privacy settings", details: "What data is used", detail: "Google receives visited pages and actions, technical device data and an IP address when connecting. Statistics use cookies. We do not send names, phone numbers, enquiry text, URL parameters or full messenger links to analytics. You can change your choice here at any time. The LumaClean manager receives enquiry form details in Telegram to reply and arrange cleaning. For data questions, contact the manager using the website contacts.", google: "How Google uses data", close: "Close"},
};

type AnalyticsWindow = Window & {dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void; lcTrack?: (name: typeof eventNames[number], data: Parameters<typeof safeEventData>[0]) => void};

export function Analytics({locale, measurementId, enabled, paths}: {locale: Locale; measurementId: string; enabled: boolean; paths: string[]}) {
  const pathname = usePathname();
  const consent = useSyncExternalStore(subscribeConsent, readConsent, serverConsent);
  const hydrated = useSyncExternalStore(subscribeReady, clientReady, serverReady);
  const [open, setOpen] = useState(false);
  const configured = enabled && /^G-[A-Z0-9]+$/.test(measurementId);
  const initialized = useRef(false);
  const lastPage = useRef("");
  const lastCalculator = useRef(0);
  const c = copy[locale];

  useEffect(() => {
    if (configured) {
      Object.assign(window, {[`ga-disable-${measurementId}`]: consent !== "yes" || !paths.includes(pathname)});
      if (consent !== "yes") (window as AnalyticsWindow).gtag?.("consent", "update", {analytics_storage: "denied"});
    }
    if (!configured || consent !== "yes" || !paths.includes(pathname)) return;
    const w = window as AnalyticsWindow;
    w.dataLayer ||= [];
    // eslint-disable-next-line prefer-rest-params -- Google's documented command queue uses IArguments.
    w.gtag ||= function () { w.dataLayer!.push(arguments); };
    const gtag = w.gtag;
    let landing = pathname;
    let source = entrySource(document.referrer, window.location.search);
    let debug = new URLSearchParams(window.location.search).get("analytics_debug") === "1";
    try {
      const previous = JSON.parse(sessionStorage.getItem("lc-analytics-entry") || "null");
      if (previous && paths.includes(previous.landing) && entrySources.includes(previous.source)) { landing = previous.landing; source = previous.source; }
      else sessionStorage.setItem("lc-analytics-entry", JSON.stringify({landing, source}));
      if (debug) sessionStorage.setItem("lc-analytics-debug", "1");
      debug ||= sessionStorage.getItem("lc-analytics-debug") === "1";
    } catch { /* Analytics still works without session storage. */ }
    const acquisition = acquisitionContext(source);
    if (!initialized.current) {
      gtag("consent", "default", {analytics_storage: "granted", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied"});
      gtag("js", new Date());
      gtag("config", measurementId, {send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false, page_location: `https://lumacleanrs.com${pathname}`, ...acquisition, ...(debug ? {debug_mode: true, traffic_type: "internal"} : {})});
      initialized.current = true;
    }
    const context = {page_location: `https://lumacleanrs.com${pathname}`, ...acquisition, page_title: document.title, locale, landing_page: landing, entry_source: source, ...(debug ? {debug_mode: true, traffic_type: "internal"} : {})};
    gtag("set", context);
    if (lastPage.current !== pathname) { gtag("event", "page_view", context); lastPage.current = pathname; }
    w.lcTrack = (name, data) => {
      if (!eventNames.includes(name)) return;
      if (name === "calculator_interaction") { if (Date.now() - lastCalculator.current < 2000) return; lastCalculator.current = Date.now(); }
      gtag("event", name, {...context, ...safeEventData(data, paths)});
    };
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element)?.closest?.("a[href]");
      if (!link) return;
      const url = new URL(link.getAttribute("href")!, window.location.origin);
      const channel = url.hostname === "t.me" ? "telegram" : ["wa.me", "api.whatsapp.com"].includes(url.hostname) ? "whatsapp" : url.protocol === "viber:" ? "viber" : undefined;
      if (channel) w.lcTrack?.("messenger_click", {locale, channel});
      if (pathname.includes("/articles/") && url.origin === window.location.origin && url.pathname.includes("/services/") && paths.includes(url.pathname)) w.lcTrack?.("article_to_service", {locale, destination: url.pathname});
    };
    document.addEventListener("click", onClick);
    return () => { delete w.lcTrack; document.removeEventListener("click", onClick); };
  }, [configured, consent, locale, measurementId, pathname, paths]);

  function choose(value: "yes" | "no") {
    memoryConsent = value;
    try { localStorage.setItem(key, value); } catch { /* Honor the choice for this page. */ }
    if (value === "no") {
      const w = window as AnalyticsWindow;
      delete w.lcTrack;
      // Disable synchronously: unloading a Script does not unload its library.
      Object.assign(w, {[`ga-disable-${measurementId}`]: true});
      w.gtag?.("consent", "update", {analytics_storage: "denied"});
      try { sessionStorage.removeItem("lc-analytics-entry"); } catch {}
      for (const cookie of document.cookie.split(";")) {
        const name = cookie.trim().split("=")[0];
        if (!/^_ga(?:_|$)/.test(name)) continue;
        for (const domain of ["", "; domain=lumacleanrs.com", "; domain=.lumacleanrs.com"]) document.cookie = `${name}=; max-age=0; path=/${domain}`;
      }
    } else {
      Object.assign(window, {[`ga-disable-${measurementId}`]: false});
      (window as AnalyticsWindow).gtag?.("consent", "update", {analytics_storage: "granted"});
    }
    window.dispatchEvent(new Event("lc-consent")); setOpen(false);
  }

  if (!configured) return null;
  return <>
    {consent === "yes" && hydrated && window.location.hostname === "lumacleanrs.com" && <Script id="lc-google-analytics" src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`} strategy="afterInteractive" />}
    <button className="lc-privacy-toggle" onClick={() => setOpen(true)} aria-expanded={open || (hydrated && consent === null)} aria-controls="lc-privacy-panel">{c.settings}</button>
    {(open || (hydrated && consent === null)) && <aside id="lc-privacy-panel" className="lc-privacy-panel" aria-label={c.settings}>
      <h2>{c.title}</h2><p>{c.body}</p>
      <details><summary>{c.details}</summary><p>{c.detail}</p><a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noreferrer">{c.google} ↗</a></details>
      <div><button onClick={() => choose("yes")}>{c.accept}</button><button onClick={() => choose("no")}>{c.deny}</button>{consent && <button onClick={() => setOpen(false)}>{c.close}</button>}</div>
    </aside>}
  </>;
}
