import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import { CrmError } from "@/lib/domain/crm";
import { SchedulingError } from "@/lib/domain/scheduling-types";
import { routingSchemas, type RoutingCommand } from "@/lib/validation/routing";
import { placesRequest } from "@/lib/services/google-places";
import {
  dayLogistics,
  findSlots,
  proposeDay,
  applyProposal,
  routeDetails,
} from "@/lib/services/routing-planning";
export const runtime = "nodejs";
export const maxDuration = 60;
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
    if (!Object.hasOwn(routingSchemas, command))
      return NextResponse.json({ ok: false }, { status: 404 });
    const raw = await request.text();
    if (raw.length > 12000)
      return NextResponse.json(
        { ok: false, error: "Слишком большой запрос" },
        { status: 413 },
      );
    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { ok: false, error: "Некорректный JSON" },
        { status: 400 },
      );
    }
    routingSchemas[command as RoutingCommand].parse(payload);
    const db = getDatabase(),
      bucket = Math.floor(Date.now() / 60000),
      bulk = ["slots", "optimize", "day"].includes(command),
      key = `routing:${bulk ? "bulk" : "places"}:${user.id}:${bucket}`;
    const limits = await db.$queryRawUnsafe<{ count: number }[]>(
      'INSERT INTO "RateLimit" ("id","key","count","lastRequest") VALUES ($1,$2,1,$3) ON CONFLICT ("key") DO UPDATE SET "count" = "RateLimit"."count" + 1 RETURNING "count"',
      randomUUID(),
      key,
      BigInt(Date.now()),
    );
    if (limits[0].count > (bulk ? 6 : 40))
      return NextResponse.json(
        { ok: false, error: "Слишком много расчётов. Повторите через минуту." },
        { status: 429 },
      );
    if (limits[0].count === 1 && bucket % 60 === 0)
      await db.rateLimit.deleteMany({
        where: {
          key: { startsWith: "routing:" },
          lastRequest: { lt: BigInt(Date.now() - 86400000) },
        },
      });
    let data: unknown;
    if (command === "autocomplete" || command === "place")
      data = await placesRequest(
        command,
        routingSchemas[command].parse(payload),
      );
    else if (command === "day") {
      const v = routingSchemas.day.parse(payload);
      data = await dayLogistics(db, v.date, v.cleanerId);
    } else if (command === "slots") data = await findSlots(db, payload);
    else if (command === "optimize")
      data = await proposeDay(
        db,
        user.id,
        routingSchemas.optimize.parse(payload).date,
      );
    else if (command === "apply") {
      data = await applyProposal(
        db,
        user.id,
        routingSchemas.apply.parse(payload).proposalId,
      );
      revalidatePath("/admin", "layout");
    } else data = await routeDetails(db, payload);
    return NextResponse.json(
      { ok: true, data },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof ZodError)
      return NextResponse.json(
        {
          ok: false,
          error: "Проверьте поля запроса",
          errors: error.issues.map((i) => ({
            field: i.path.join("."),
            message: i.message,
          })),
        },
        { status: 400 },
      );
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
            error.code === "STALE"
              ? 409
              : error.code === "NOT_FOUND"
                ? 404
                : error.code === "FORBIDDEN"
                  ? 403
                  : 400,
        },
      );
    console.error(JSON.stringify({ msg: "routing_request_failed" }));
    return NextResponse.json(
      {
        ok: false,
        error: "Расчёт временно недоступен. Ручное планирование работает.",
      },
      { status: 503 },
    );
  }
}
