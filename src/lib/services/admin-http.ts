import "server-only";
import { randomUUID } from "node:crypto";
import { getDatabase } from "@/lib/database/client";
import { CrmError } from "@/lib/domain/crm";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
export function financeError(e: unknown) {
  if (e instanceof ZodError)
    return NextResponse.json(
      {
        ok: false,
        error: "Проверьте поля формы",
        errors: e.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 },
    );
  if (e instanceof CrmError)
    return NextResponse.json(
      { ok: false, error: e.message },
      {
        status:
          e.code === "FORBIDDEN"
            ? 403
            : e.code === "STALE"
              ? 409
              : e.code === "NOT_FOUND"
                ? 404
                : e.code === "TOO_LARGE"
                  ? 413
                  : e.code === "RATE_LIMIT"
                    ? 429
                    : 400,
      },
    );
  console.error(
    JSON.stringify({ level: "error", msg: "finance_operation_failed" }),
  );
  return NextResponse.json(
    { ok: false, error: "Операция временно недоступна. Повторите попытку." },
    { status: 503 },
  );
}
export async function boundedBody(request: Request, max: number) {
  if (Number(request.headers.get("content-length")) > max)
    throw new CrmError("TOO_LARGE", "Слишком большой запрос.");
  const reader = request.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const r = await reader.read();
      if (r.done) break;
      size += r.value.length;
      if (size > max) {
        await reader.cancel();
        throw new CrmError("TOO_LARGE", "Слишком большой запрос.");
      }
      chunks.push(r.value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}
export async function adminRateLimit(
  userId: string,
  kind: string,
  max: number,
) {
  const db = getDatabase(),
    now = Date.now(),
    bucket = Math.floor(now / 60000),
    key = `finance:${kind}:${userId}:${bucket}`;
  const result = await db.$queryRaw<
    { count: number }[]
  >`INSERT INTO "RateLimit" (id,key,count,"lastRequest") VALUES (${randomUUID()},${key},1,${BigInt(now)}) ON CONFLICT (key) DO UPDATE SET count="RateLimit".count+1 RETURNING count`;
  if (result[0].count > max)
    throw new CrmError(
      "RATE_LIMIT",
      "Слишком много запросов. Повторите через минуту.",
    );
  if (result[0].count === 1 && bucket % 60 === 0)
    await db.rateLimit.deleteMany({
      where: {
        key: { startsWith: "finance:" },
        lastRequest: { lt: BigInt(now - 86400000) },
      },
    });
}
