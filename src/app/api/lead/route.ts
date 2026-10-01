import { NextResponse } from "next/server";
import { websiteLeadSchema } from "@/lib/validation/crm";
import { getDatabase } from "@/lib/database/client";
import {
  saveWebsiteLead,
  notifyWebsiteLead,
} from "@/lib/services/website-leads";
import { CrmError } from "@/lib/domain/crm";
import { articlePath, getPublishedArticles } from "@/lib/articles";
import { getServicePath } from "@/lib/seo-services";
import { serviceIds } from "@/lib/pricing";
import { routing } from "@/i18n/routing";
export const runtime = "nodejs";
const paths = new Set(
  routing.locales.flatMap((locale) => [
    `/${locale}`,
    `/${locale}/articles`,
    ...serviceIds.map((s) => getServicePath(locale, s)),
    ...getPublishedArticles().map((a) => articlePath(a, locale)),
  ]),
);
export async function POST(request: Request) {
  const raw = await request.text();
  if (raw.length > 16000)
    return NextResponse.json({ ok: false }, { status: 413 });
  const parsed = websiteLeadSchema.safeParse(
    await Promise.resolve()
      .then(() => JSON.parse(raw))
      .catch(() => null),
  );
  if (
    !parsed.success ||
    (parsed.data.attribution && !paths.has(parsed.data.attribution.landing))
  ) {
    console.warn(
      JSON.stringify({
        level: "warning",
        msg: "lead_validation_failed",
        route: "/api/lead",
      }),
    );
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  try {
    const db = getDatabase();
    const lead = await saveWebsiteLead(db, parsed.data);
    if (lead.created) await notifyWebsiteLead(db, lead, parsed.data);
    return NextResponse.json(
      { ok: true, reference: lead.reference },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof CrmError)
      return NextResponse.json(
        { ok: false },
        { status: error.code === "IDEMPOTENCY" ? 409 : 400 },
      );
    console.error(
      JSON.stringify({
        level: "error",
        msg: "lead_storage_failed",
        route: "/api/lead",
      }),
    );
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
