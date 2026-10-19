import {leadRequestSource, LeadRateLimitError} from '@/lib/services/lead-rate-limit';
import {boundedBody} from '@/lib/services/admin-http';
import { after, NextResponse } from "next/server";
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
import {upholsteryPath} from '@/lib/upholstery-content';
export const runtime = "nodejs";
const paths = new Set(
  routing.locales.flatMap((locale) => [
    `/${locale}`,
    upholsteryPath(locale),
    `/${locale}/articles`,
    ...serviceIds.map((s) => getServicePath(locale, s)),
    ...getPublishedArticles().map((a) => articlePath(a, locale)),
  ]),
);
export async function POST(request: Request) {
  let raw:string;
  try{raw=(await boundedBody(request,16000)).toString();}
  catch(error){return NextResponse.json({ok:false},{status:error instanceof CrmError&&error.code==='TOO_LARGE'?413:400});}
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
    const lead = await saveWebsiteLead(db, parsed.data, leadRequestSource(request));
    after(()=>notifyWebsiteLead(db, lead, parsed.data));
    return NextResponse.json(
      { ok: true, reference: lead.reference },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if(error instanceof LeadRateLimitError){
      const message={ru:'Слишком много заявок. Подождите немного и повторите попытку.',en:'Too many enquiries. Please wait a little and try again.',sr:'Previše upita. Sačekajte malo i pokušajte ponovo.'}[parsed.data.locale];
      return NextResponse.json({ok:false,error:'RATE_LIMIT',message},{status:429,headers:{'Retry-After':String(error.retryAfter),'Cache-Control':'no-store'}});
    }
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
