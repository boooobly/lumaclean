import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import { financeSchemas, type FinanceCommand } from "@/lib/validation/finance";
import { runFinanceCommand } from "@/lib/services/finance-commands";
import {
  boundedBody,
  adminRateLimit,
  financeError,
} from "@/lib/services/admin-http";
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
      return NextResponse.json({ ok: false }, { status: 403 });
    const { command } = await params;
    if (!Object.hasOwn(financeSchemas, command))
      return NextResponse.json({ ok: false }, { status: 404 });
    await adminRateLimit(user.id, "command", 60);
    let payload: unknown;
    try {
      payload = JSON.parse((await boundedBody(request, 32000)).toString());
    } catch (e) {
      if (e instanceof CrmError) throw e;
      throw new CrmError("VALIDATION", "Некорректный JSON.");
    }
    const data = await runFinanceCommand(
      getDatabase(),
      user.id,
      command as FinanceCommand,
      payload,
    );
    if (command !== "duration-estimate") revalidatePath("/admin", "layout");
    return NextResponse.json(
      { ok: true, data },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return financeError(e);
  }
}
