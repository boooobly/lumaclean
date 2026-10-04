import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import { boundedBody } from "@/lib/services/admin-http";
import { scopedConversation, rateLimit } from "./inbox";
import { attachmentSelect, uploadAttachment } from "./chat-attachments";
export async function chatUpload(request: Request, admin = false) {
  const origin = request.headers.get("origin");
  if (
    !origin ||
    ![
      process.env.BETTER_AUTH_URL,
      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    ].includes(origin)
  )
    return NextResponse.json({ ok: false }, { status: 403 });
  try {
    const db = getDatabase(),
      requestId = z.uuid().parse(request.headers.get("x-upload-id"));
    const user = admin ? await getCurrentUser() : null;
    if (admin && (!user || user.role !== "ADMIN"))
      return NextResponse.json({ ok: false }, { status: 403 });
    const conversationId = admin
      ? z
          .string()
          .min(1)
          .max(80)
          .parse(request.headers.get("x-conversation-id"))
      : (
          await scopedConversation(
            db,
            (await cookies()).get("luma_conversation")?.value ?? null,
          )
        )?.id;
    if (!conversationId)
      return NextResponse.json({ ok: false }, { status: 401 });
    await rateLimit(db, `upload:${conversationId}`, 12);
    const bytes = await boundedBody(request, 3 * 1024 * 1024);
    const attachment = await uploadAttachment(
      db,
      conversationId,
      requestId,
      bytes,
      request.headers.get("content-type") ?? "",
      admin ? "ADMIN" : "CLIENT",
    );
    const safe = Object.fromEntries(
      Object.keys(attachmentSelect).map((k) => [
        k,
        attachment[k as keyof typeof attachment],
      ]),
    );
    return NextResponse.json(
      { ok: true, attachment: safe },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "IMAGE_UPLOAD_REJECTED" },
      { status: 400 },
    );
  }
}
