import { cookies } from "next/headers";
import { getDatabase } from "@/lib/database/client";
import {
  publicConversation,
  scopedConversation,
  rateLimit,
} from "@/lib/agent/inbox";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request) {
  const db = getDatabase(),
    c = await scopedConversation(
      db,
      (await cookies()).get("luma_conversation")?.value ?? null,
    );
  const headers = {
    "Cache-Control": "private, no-store",
    "X-Robots-Tag": "noindex, nofollow",
  };
  if (!c) return new Response(null, { status: 401, headers });
  try {
    await rateLimit(db, `events:${c.id}`, 20);
  } catch {
    return new Response(null, { status: 429, headers });
  }
  let stopped = false,
    timer: ReturnType<typeof setTimeout> | undefined,
    wake: (() => void) | undefined;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder(),
        deadline = Date.now() + 45000;
      let previous: Awaited<ReturnType<typeof publicConversation>> | null =
          null,
        sequence = 0;
      const abort = () => {
        stopped = true;
        if (timer) clearTimeout(timer);
        wake?.();
      };
      request.signal.addEventListener("abort", abort, { once: true });
      try {
        controller.enqueue(encoder.encode("retry: 2500\n\n"));
        while (!stopped && Date.now() < deadline) {
          const snapshot = await publicConversation(db, c);
          if (stopped) break;
          const event = !previous
            ? "message"
            : previous.control !== snapshot.control
              ? snapshot.control === "HUMAN_CONTROL"
                ? "handoff"
                : "control"
              : JSON.stringify(previous.messages.map((m) => m.id)) !==
                  JSON.stringify(snapshot.messages.map((m) => m.id))
                ? "message"
                : JSON.stringify(previous.messages.map((m) => m.readAt)) !==
                    JSON.stringify(snapshot.messages.map((m) => m.readAt))
                  ? "read"
                  : previous.typing !== snapshot.typing ||
                      previous.pending !== snapshot.pending
                    ? "typing"
                    : JSON.stringify(previous.quickReplies) !==
                        JSON.stringify(snapshot.quickReplies)
                      ? "quickReplies"
                      : JSON.stringify(previous.booking) !==
                          JSON.stringify(snapshot.booking)
                        ? "booking"
                        : JSON.stringify(previous.confirmation) !==
                            JSON.stringify(snapshot.confirmation)
                          ? "confirmation"
                          : null;
          if (event) {
            controller.enqueue(
              encoder.encode(
                `id: ${++sequence}\nevent: ${event}\ndata: ${JSON.stringify({ conversation: snapshot })}\n\n`,
              ),
            );
            previous = snapshot;
          } else controller.enqueue(encoder.encode(": heartbeat\n\n"));
          await new Promise<void>((resolve) => {
            wake = resolve;
            timer = setTimeout(resolve, 1500);
          });
          wake = undefined;
        }
      } catch {
        if (!stopped)
          controller.enqueue(encoder.encode("event: reconnect\ndata: {}\n\n"));
      } finally {
        request.signal.removeEventListener("abort", abort);
        if (timer) clearTimeout(timer);
        if (!stopped) controller.close();
      }
    },
    cancel() {
      stopped = true;
      if (timer) clearTimeout(timer);
      wake?.();
    },
  });
  return new Response(stream, {
    headers: {
      ...headers,
      "Content-Type": "text/event-stream",
      "X-Accel-Buffering": "no",
    },
  });
}
