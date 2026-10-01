import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import { commandSchemas, type CommandName } from "@/lib/validation/crm";
import {
  runCrmCommand,
  DuplicateClientError,
} from "@/lib/services/crm-commands";
import { CrmError } from "@/lib/domain/crm";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ command: string }> },
) {
  if (
    request.headers.get("origin") !== process.env.BETTER_AUTH_URL ||
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
    if (!Object.hasOwn(commandSchemas, command))
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
    commandSchemas[command as CommandName].parse(payload);
    const result = await runCrmCommand(
      getDatabase(),
      user.id,
      command as CommandName,
      payload,
    );
    revalidatePath("/admin", "layout");
    return NextResponse.json(
      { ok: true, ...result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof ZodError)
      return NextResponse.json(
        {
          ok: false,
          error: "Проверьте поля формы",
          errors: error.issues.map((i) => ({
            field: String(i.path.at(-1) ?? ""),
            message: i.message,
          })),
        },
        { status: 400 },
      );
    if (error instanceof DuplicateClientError)
      return NextResponse.json(
        { ok: false, error: error.message, matches: error.matches },
        { status: 409 },
      );
    if (error instanceof CrmError)
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
          errors: error.field
            ? [{ field: error.field, message: error.message }]
            : [],
        },
        {
          status:
            error.code === "NOT_FOUND"
              ? 404
              : error.code === "FORBIDDEN"
                ? 403
                : 400,
        },
      );
    console.error(
      JSON.stringify({ level: "error", msg: "crm_mutation_failed" }),
    );
    return NextResponse.json(
      { ok: false, error: "Не удалось сохранить. Повторите попытку." },
      { status: 503 },
    );
  }
}
