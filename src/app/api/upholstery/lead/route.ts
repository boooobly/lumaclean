import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { getDatabase } from "@/lib/database/client";
import {
  boundedBody,
  adminRateLimit,
  financeError,
} from "@/lib/services/admin-http";
import { saveUpholsteryLead } from "@/lib/services/upholstery-leads";
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
    const result = await saveUpholsteryLead(
      getDatabase(),
      JSON.parse((await boundedBody(request, 20000)).toString()),
    );
    return NextResponse.json(
      { ok: true, result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return financeError(e);
  }
}
