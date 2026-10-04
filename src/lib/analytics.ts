type EventName = "form_start" | "calculator_interaction" | "generate_lead" | "lead_error" | "messenger_click" | "article_to_service";
type EventData = {locale?: string; service?: string; error_type?: string; channel?: string; destination?: string};
type TrackingWindow = Window & {lcTrack?: (name: EventName, data: EventData) => void};

// Deliberately accepts no customer fields, form values, query strings or free text.
export function trackEvent(name: EventName, data: EventData = {}) {
  if (typeof window !== "undefined") (window as TrackingWindow).lcTrack?.(name, data);
}

export function leadAttribution(): {landing: string; source: string} | undefined {
  try {
    if (localStorage.getItem("lc-analytics-consent-v1") !== "yes") return;
    const entry = JSON.parse(sessionStorage.getItem("lc-analytics-entry") || "null");
    if (entry && typeof entry.landing === "string" && typeof entry.source === "string") return {landing: entry.landing, source: entry.source};
  } catch { /* A visitor can submit without analytics or storage. */ }
}

export const eventNames = ["form_start", "calculator_interaction", "generate_lead", "lead_error", "messenger_click", "article_to_service"] as const;
export const entrySources = ["google_business_profile", "google", "yandex", "bing", "internal", "referral", "direct_or_unknown"] as const;
export type EntrySource = typeof entrySources[number];

// Only this public, fixed campaign is accepted. Arbitrary URL values never reach GA.
export function entrySource(referrer: string, search: string): EntrySource {
  const params = new URLSearchParams(search);
  if (params.get("utm_source") === "google" && params.get("utm_medium") === "organic" && params.get("utm_campaign") === "google_business_profile") return "google_business_profile";
  return sourceFromReferrer(referrer);
}

export function acquisitionContext(source: EntrySource) {
  if (source === "google_business_profile") return {page_referrer: "", campaign_source: "google", campaign_medium: "organic", campaign_name: "google_business_profile"};
  // Keep search attribution without exposing referrer paths, queries or private hosts.
  const origins = {google: "https://www.google.com/", yandex: "https://yandex.ru/", bing: "https://www.bing.com/"};
  return {page_referrer: source in origins ? origins[source as keyof typeof origins] : ""};
}
export function safeEventData(data: EventData, paths: readonly string[]) {
  const clean: Record<string, string> = {};
  if (["ru", "sr", "en"].includes(data.locale || "")) clean.locale = data.locale!;
  if (["regular", "deep", "move", "airbnb", "office"].includes(data.service || "")) clean.service = data.service!;
  if (["validation", "server", "network"].includes(data.error_type || "")) clean.error_type = data.error_type!;
  if (["telegram", "whatsapp", "viber"].includes(data.channel || "")) clean.channel = data.channel!;
  if (data.destination && paths.includes(data.destination)) clean.destination = data.destination;
  return clean;
}

export function sourceFromReferrer(referrer: string): EntrySource {
  try {
    const host = new URL(referrer).hostname;
    if (/^(www\.)?google\.(com|rs|ru|co\.uk)$/.test(host)) return "google";
    if (/^(www\.)?(yandex\.(ru|com|rs)|ya\.ru)$/.test(host)) return "yandex";
    if (/^(www\.)?bing\.com$/.test(host)) return "bing";
    if (host === "lumacleanrs.com") return "internal";
    return "referral";
  } catch { return "direct_or_unknown"; }
}
