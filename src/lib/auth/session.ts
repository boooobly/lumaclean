import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth, isAuthConfigured } from "./config";
import { getDatabase } from "@/lib/database/client";

export const getCurrentUser = cache(async () => {
  const requestHeaders = await headers();
  // Missing cookie is only an early negative check; never an authorization check.
  if (!requestHeaders.get("cookie") || !isAuthConfigured()) return null;
  try {
    const session = await getAuth().api.getSession({
      headers: requestHeaders,
      query: { disableCookieCache: true },
    });
    if (!session) return null;
    const user = await getDatabase().user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, role: true, active: true },
    });
    return user?.active ? user : null;
  } catch {
    // Avoid leaking session query inputs or driver details into framework logs.
    throw new Error("Admin authentication unavailable");
  }
});

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") redirect("/admin/login");
  return user;
}
