import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import { scopedConversation } from "@/lib/agent/inbox";
import { PrivateBlobStorage } from "@/lib/agent/chat-attachments";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const headers = {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex, nofollow",
  };
  try {
    const db = getDatabase(),
      { id } = await params,
      [c, user] = await Promise.all([
        scopedConversation(
          db,
          (await cookies()).get("luma_conversation")?.value ?? null,
        ),
        getCurrentUser(),
      ]);
    const row = await db.chatAttachment.findUnique({ where: { id } });
    if (!row || (user?.role !== "ADMIN" && row.conversationId !== c?.id))
      return new Response(null, { status: 404, headers });
    const bytes = await new PrivateBlobStorage().read(
      new URL(request.url).searchParams.get("thumb") === "1"
        ? row.thumbnailKey
        : row.storageKey,
    );
    return new Response(new Uint8Array(bytes), {
      headers: {
        ...headers,
        "Content-Type": row.mimeType,
        "Content-Disposition": "inline",
      },
    });
  } catch {
    return new Response(null, { status: 404, headers });
  }
}
