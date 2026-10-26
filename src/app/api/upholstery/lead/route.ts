import { after, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { getDatabase } from "@/lib/database/client";
import {
  boundedBody,
  adminRateLimit,
  financeError,
} from "@/lib/services/admin-http";
import { saveUpholsteryLead } from "@/lib/services/upholstery-leads";
import {publishWebsiteLead, notifyWebsiteLead} from '@/lib/services/website-leads';
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return NextResponse.json({ ok: false }, { status: 415 });
  try {
    await adminRateLimit(
      createHash("sha256")
        .update(request.headers.get("x-forwarded-for") ?? "unknown")
        .digest("hex"),
      "upholstery-lead",
      6,
    );
    const db = getDatabase();
    const result = await saveUpholsteryLead(
      db,
      JSON.parse((await boundedBody(request, 20000)).toString()),
    );
    await publishWebsiteLead(db, result.id);
    try {after(() => notifyWebsiteLead(db, result));}
    catch {console.error(JSON.stringify({msg: 'lead_notification_recovery_pending'}));}
    return NextResponse.json(
      { ok: true, result: {reference: result.reference} },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return financeError(e);
  }
}
