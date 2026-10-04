import {publishNotifications} from "@/lib/agent/notifications";
import { after, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import {
  schedulingSchemas,
  type SchedulingCommand,
} from "@/lib/validation/scheduling";
import { runSchedulingCommand } from "@/lib/services/scheduling-commands";
import { SchedulingError } from "@/lib/domain/scheduling-types";
import { CrmError } from "@/lib/domain/crm";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ command: string }> },
) {
  const expectedOrigin = process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}` : process.env.BETTER_AUTH_URL;
  if (
    !expectedOrigin || request.headers.get("origin") !== expectedOrigin ||
    !request.headers.get("content-type")?.startsWith("application/json")
  )
    return NextResponse.json(
      { ok: false, error: "Недопустимый запрос" },
      { status: 403 },
    );
  try {
    const user = await getCurrentUser();
    if (!user)
      return NextResponse.json(
        { ok: false, error: "Войдите в систему" },
        { status: 401 },
      );
    if (user.role !== "ADMIN")
      return NextResponse.json(
        { ok: false, error: "Недостаточно прав" },
        { status: 403 },
      );
    const { command } = await params;
    if (!Object.hasOwn(schedulingSchemas, command))
      return NextResponse.json({ ok: false }, { status: 404 });
    const raw = await request.text();
    if (raw.length > 32000)
      return NextResponse.json(
        { ok: false, error: "Слишком большой запрос" },
        { status: 413 },
      );
    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { ok: false, error: "Некорректный запрос" },
        { status: 400 },
      );
    }
    const result = await runSchedulingCommand(
      getDatabase(),
      user.id,
      command as SchedulingCommand,
      payload,
    );
    after(()=>publishNotifications(getDatabase()));
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
    if (error instanceof ZodError)
      return NextResponse.json(
        {
          ok: false,
          error: "Проверьте поля формы",
          errors: error.issues.map((i) => ({
            field: i.path.join("."),
            message: i.message,
          })),
        },
        { status: 400 },
      );
    if (error instanceof CrmError)
      return NextResponse.json(
        { ok: false, error: error.message },
        {
          status:
            error.code === "NOT_FOUND"
              ? 404
              : error.code === "FORBIDDEN"
                ? 403
                : error.code === "STALE"
                  ? 409
                  : 400,
        },
      );
    console.error(
      JSON.stringify({ level: "error", msg: "scheduling_mutation_failed" }),
    );
    return NextResponse.json(
      { ok: false, error: "Не удалось сохранить. Повторите попытку." },
      { status: 503 },
    );
  }
}
