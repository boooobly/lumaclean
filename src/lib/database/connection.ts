/** Preserve certificate and hostname verification explicitly for Neon pg clients. */
export function pgConnectionString(connectionString: string) {
  const url = new URL(connectionString);
  if (url.hostname.endsWith(".neon.tech")) {
    url.searchParams.set("sslmode", "verify-full");
  }
  return url.toString();
}
