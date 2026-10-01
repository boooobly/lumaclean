import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { findClientOptions } from "@/lib/services/crm-queries";
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });
    if (user.role !== "ADMIN")
      return NextResponse.json({ ok: false }, { status: 403 });
    const params = new URL(request.url).searchParams,
      q = (params.get("q") ?? "").slice(0, 100),
      id = (params.get("id") ?? "").slice(0, 80);
    const rows = await findClientOptions(q, id || undefined);
    return NextResponse.json(
      {
        ok: true,
        rows: rows.map((r) => ({
          ...r,
          discountPercent: Number(r.discountPercent ?? 0),
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
