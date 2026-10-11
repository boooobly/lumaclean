import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import { runCalendarRepeat } from "@/lib/services/calendar-repeat";
import { CrmError } from "@/lib/domain/crm";
import { SchedulingError } from "@/lib/domain/scheduling-types";
export const runtime = "nodejs";
export const maxDuration = 180;
export async function POST(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  const origin =
    process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.BETTER_AUTH_URL;
  if (
    !origin ||
    request.headers.get("origin") !== origin ||
    !request.headers.get("content-type")?.startsWith("application/json")
  )
    return NextResponse.json(
      { ok: false, error: "Недопустимый запрос" },
      { status: 403 },
    );
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN")
      return NextResponse.json(
        { ok: false, error: "Недостаточно прав" },
        { status: user ? 403 : 401 },
      );
    const { action } = await params;
    if (
      ![
        "preview",
        "create",
        "series-info",
        "series-preview",
        "series-update",
        "series-stop",
      ].includes(action)
    )
      return NextResponse.json({ ok: false }, { status: 404 });
    const text = await request.text();
    if (text.length > 16000)
      return NextResponse.json(
        { ok: false, error: "Слишком большой запрос" },
        { status: 413 },
      );
    let input: unknown;
    try {
      input = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { ok: false, error: "Некорректный JSON" },
        { status: 400 },
      );
    }
    const result = await runCalendarRepeat(
      getDatabase(),
      user.id,
      action,
      input,
    );
    if (["create", "series-update", "series-stop"].includes(action))
      revalidatePath("/admin", "layout");
    return NextResponse.json(
      { ok: true, ...result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof SchedulingError)
      return NextResponse.json(
        { ok: false, error: error.message, issues: error.issues },
        { status: 409 },
      );
    if (error instanceof CrmError)
      return NextResponse.json(
        { ok: false, error: error.message },
        {
          status:
            error.code === "FORBIDDEN"
              ? 403
              : error.code === "NOT_FOUND"
                ? 404
                : 409,
        },
      );
    if (error instanceof ZodError)
      return NextResponse.json(
        { ok: false, error: "Проверьте поля формы" },
        { status: 400 },
      );
    console.error(
      JSON.stringify({ level: "error", msg: "calendar_repeat_failed" }),
    );
    return NextResponse.json(
      {
        ok: false,
        error: "Не удалось проверить или сохранить уборки. Повторите запрос.",
      },
      { status: 503 },
    );
  }
}
