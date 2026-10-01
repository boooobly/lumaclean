import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import { boundedBody, adminRateLimit } from "@/lib/services/admin-http";
import { previewLegacy, applyLegacy } from "@/lib/services/legacy-import";
import { CrmError } from "@/lib/domain/crm";
import { financeError } from "@/lib/services/admin-http";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(
  request: Request,
  { params }: { params: Promise<{ command: string }> },
) {
  if (request.headers.get("origin") !== process.env.BETTER_AUTH_URL)
    return NextResponse.json({ ok: false }, { status: 403 });
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
    if (!["preview", "apply"].includes(command))
      return NextResponse.json({ ok: false }, { status: 404 });
    await adminRateLimit(user.id, "import", 4);
    let data: unknown;
    if (command === "preview") {
      if (
        !request.headers.get("content-type")?.startsWith("multipart/form-data")
      )
        throw new CrmError("VALIDATION", "Загрузите .xlsx файл.");
      const body = await boundedBody(request, 2 * 1024 * 1024 + 20000);
      const form = await new Response(body, {
        headers: { "content-type": request.headers.get("content-type")! },
      }).formData();
      const file = form.get("file");
      if (
        !(file instanceof File) ||
        !file.name.toLowerCase().endsWith(".xlsx") ||
        file.size > 2 * 1024 * 1024
      )
        throw new CrmError("VALIDATION", "Нужен .xlsx до 2 МБ.");
      data = await previewLegacy(
        getDatabase(),
        user.id,
        Buffer.from(await file.arrayBuffer()),
        file.name,
      );
    } else {
      if (!request.headers.get("content-type")?.startsWith("application/json"))
        throw new CrmError("VALIDATION", "Некорректный запрос.");
      let payload: unknown;
      try {
        payload = JSON.parse((await boundedBody(request, 200000)).toString());
      } catch (e) {
        if (e instanceof CrmError) throw e;
        throw new CrmError("VALIDATION", "Некорректный JSON.");
      }
      data = await applyLegacy(getDatabase(), user.id, payload);
      revalidatePath("/admin", "layout");
    }
    return NextResponse.json(
      { ok: true, data },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return financeError(e);
  }
}
