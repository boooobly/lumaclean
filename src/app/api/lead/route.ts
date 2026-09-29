import {randomUUID} from "node:crypto";
import {NextResponse} from "next/server";
import {z} from "zod";
import {articlePath, getPublishedArticles} from "@/lib/articles";
import {getServicePath} from "@/lib/seo-services";
import {serviceIds} from "@/lib/pricing";
import {routing} from "@/i18n/routing";
import {entrySources} from "@/lib/analytics";

const publicPaths = new Set(routing.locales.flatMap(locale => [`/${locale}`, `/${locale}/articles`, ...serviceIds.map(s => getServicePath(locale, s)), ...getPublishedArticles().map(a => articlePath(a, locale))]));

const schema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(6).max(40),
  comment: z.string().trim().max(1000).optional(),
  estimate: z.string().trim().max(3000).optional(),
  locale: z.enum(["ru", "sr", "en"]).optional(),
  service: z.enum(serviceIds).optional(),
  consent: z.literal(true),
  attribution: z.object({landing: z.string().refine(value => publicPaths.has(value)), source: z.enum(entrySources)}).optional().catch(undefined),
});

const localeNames = {ru: "Русский", sr: "Srpski", en: "English"} as const;
const serviceNames = {regular: "Поддерживающая", deep: "Генеральная", move: "Въезд / выезд", airbnb: "Airbnb", office: "Офис"} as const;
const route = "/api/lead";

function leadReference(now: Date) {
  const dateParts = Object.fromEntries(new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Belgrade",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now).map(part => [part.type, part.value]));
  return `LC-${dateParts.year}${dateParts.month}${dateParts.day}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

export async function POST(request: Request) {
  const started = Date.now();
  const requestId = request.headers.get("x-vercel-id") || undefined;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    console.warn(JSON.stringify({level: "warning", msg: "lead_validation_failed", route, requestId, ms: Date.now() - started}));
    return NextResponse.json({ok: false}, {status: 400});
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.error(JSON.stringify({level: "error", msg: "lead_delivery_not_configured", route, requestId, ms: Date.now() - started}));
    return NextResponse.json({ok: false, reason: "not-configured"}, {status: 503});
  }

  const {name, phone, comment, estimate, locale, service, attribution} = parsed.data;
  const now = new Date();
  const reference = leadReference(now);
  const logContext = {
    route,
    requestId,
    leadReference: reference,
    locale: locale || "unknown",
    service: service || "unknown",
    entrySource: attribution?.source || "unavailable",
    landingPage: attribution?.landing || "unavailable",
  };
  const submittedAt = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Belgrade",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(now);
  const text = [
    "🧹 Новая заявка LumaClean",
    `Номер: ${reference}`,
    "",
    `Имя: ${name}`,
    `Телефон: ${phone}`,
    locale ? `Язык: ${localeNames[locale]}` : "",
    service ? `Услуга: ${serviceNames[service]}` : "",
    attribution ? `Источник (по браузеру): ${attribution.source}\nСтраница входа: ${attribution.landing}` : "Источник: не определён (можно уточнить у клиента)",
    comment ? `Комментарий: ${comment}` : "Комментарий: —",
    estimate ? `\n${estimate}` : "",
    `\nОтправлено: ${submittedAt}`,
  ].filter(Boolean).join("\n");

  try {
    console.log(JSON.stringify({level: "info", msg: "lead_delivery_started", ...logContext}));
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({chat_id: chatId, text}),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.error(JSON.stringify({level: "error", msg: "lead_delivery_failed", ...logContext, upstreamStatus: response.status, ms: Date.now() - started}));
      return NextResponse.json({ok: false}, {status: 502});
    }
    console.log(JSON.stringify({level: "info", msg: "lead_delivered", ...logContext, ms: Date.now() - started}));
    return NextResponse.json({ok: true});
  } catch {
    console.error(JSON.stringify({level: "error", msg: "lead_delivery_failed", ...logContext, errorType: "network_or_timeout", ms: Date.now() - started}));
    return NextResponse.json({ok: false}, {status: 502});
  }
}
