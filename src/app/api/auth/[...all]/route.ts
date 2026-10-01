import { toNextJsHandler } from "better-auth/next-js";
import { getAuth, isAuthConfigured } from "@/lib/auth/config";

export const runtime = "nodejs";
const permitted = new Set([
  "/api/auth/sign-in/email",
  "/api/auth/sign-out",
  "/api/auth/get-session",
]);

async function handle(request: Request) {
  // Intentionally expose no sign-up, role/account mutation or provisioning API.
  if (!permitted.has(new URL(request.url).pathname))
    return Response.json({ error: "Not found" }, { status: 404 });
  if (!isAuthConfigured())
    return Response.json(
      { error: "Authentication unavailable" },
      { status: 503 },
    );
  try {
    const handlers = toNextJsHandler(getAuth());
    const response = await (request.method === "GET"
      ? handlers.GET(request)
      : handlers.POST(request));
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    return Response.json(
      { error: "Authentication unavailable" },
      { status: 503 },
    );
  }
}

export const GET = handle;
export const POST = handle;
