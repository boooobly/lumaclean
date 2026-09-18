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
  consent: z.literal(true),
  attribution: z.object({landing: z.string().refine(value => publicPaths.has(value)), source: z.enum(entrySources)}).optional().catch(undefined),
});

const localeNames = {ru: "Русский", sr: "Srpski", en: "English"} as const;

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ok: false}, {status: 400});

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return NextResponse.json({ok: false, reason: "not-configured"}, {status: 503});

  const {name, phone, comment, estimate, locale, attribution} = parsed.data;
  const submittedAt = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Belgrade",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date());
  const text = [
    "🧹 Новая заявка LumaClean",
    "",
    `Имя: ${name}`,
    `Телефон: ${phone}`,
    locale ? `Язык: ${localeNames[locale]}` : "",
    attribution ? `Источник (по браузеру): ${attribution.source}\nСтраница входа: ${attribution.landing}` : "Источник: не определён (можно уточнить у клиента)",
    comment ? `Комментарий: ${comment}` : "Комментарий: —",
    estimate ? `\n${estimate}` : "",
    `\nОтправлено: ${submittedAt}`,
  ].filter(Boolean).join("\n");

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({chat_id: chatId, text}),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return NextResponse.json({ok: false}, {status: 502});
    return NextResponse.json({ok: true});
  } catch {
    return NextResponse.json({ok: false}, {status: 502});
  }
}
