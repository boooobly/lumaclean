import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import {
  boundedBody,
  adminRateLimit,
  financeError,
} from "@/lib/services/admin-http";
import { runUpholsteryCommand } from "@/lib/services/upholstery-commands";
import { SchedulingError } from "@/lib/domain/scheduling-types";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function POST(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  if (
    ![
      process.env.BETTER_AUTH_URL,
      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    ].includes(request.headers.get("origin")) ||
    !request.headers.get("content-type")?.startsWith("application/json")
  )
    return NextResponse.json({ ok: false }, { status: 403 });
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });
    if (user.role !== "ADMIN")
      return NextResponse.json({ ok: false }, { status: 403 });
    const { action } = await params;
    await adminRateLimit(user.id, "upholstery", 40);
    const result = await runUpholsteryCommand(
      getDatabase(),
      user.id,
      action,
      JSON.parse((await boundedBody(request, 22000)).toString()),
    );
    if (action !== "preview") {
      revalidatePath("/admin", "layout");
      if (action === "settings") revalidatePath("/[locale]", "layout");
    }
    return NextResponse.json(
      { ok: true, result },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    if (e instanceof SchedulingError)
      return NextResponse.json(
        {
          ok: false,
          error:
            "На это время есть конфликт или не завершена проверка химчистки.",
          issues: e.issues,
        },
        { status: 409 },
      );
    return financeError(e);
  }
}
