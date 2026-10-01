import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { getCalendarData } from "@/lib/services/scheduling-queries";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });
    if (user.role !== "ADMIN")
      return NextResponse.json({ ok: false }, { status: 403 });
    const q = new URL(request.url).searchParams;
    const data = await getCalendarData({
      mode: q.get("mode") ?? undefined,
      date: q.get("date") ?? undefined,
      cleanerId: q.get("cleanerId") || undefined,
    });
    return NextResponse.json(
      { ok: true, data },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof ZodError)
      return NextResponse.json(
        { ok: false, error: "Некорректный период календаря" },
        { status: 400 },
      );
    return NextResponse.json(
      { ok: false, error: "Календарь временно недоступен" },
      { status: 503 },
    );
  }
}
