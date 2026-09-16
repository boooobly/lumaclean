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
export function safeEventData(data: EventData, paths: readonly string[]) {
  const clean: Record<string, string> = {};
  if (["ru", "sr", "en"].includes(data.locale || "")) clean.locale = data.locale!;
  if (["regular", "deep", "move", "airbnb", "office"].includes(data.service || "")) clean.service = data.service!;
  if (["validation", "server", "network"].includes(data.error_type || "")) clean.error_type = data.error_type!;
  if (["telegram", "whatsapp", "viber"].includes(data.channel || "")) clean.channel = data.channel!;
  if (data.destination && paths.includes(data.destination)) clean.destination = data.destination;
  return clean;
}

export function sourceFromReferrer(referrer: string) {
  try {
    const host = new URL(referrer).hostname;
    if (/^(www\.)?google\.(com|rs|ru|co\.uk)$/.test(host)) return "google";
    if (/^(www\.)?(yandex\.(ru|com|rs)|ya\.ru)$/.test(host)) return "yandex";
    if (/^(www\.)?bing\.com$/.test(host)) return "bing";
    if (host === "lumacleanrs.com") return "internal";
    return "referral";
  } catch { return "direct_or_unknown"; }
}
