export type BusMapsAccess = "ACTIVE" | "PENDING_APPROVAL" | "UNAVAILABLE";

export function busMapsAccess(key = process.env.BUSMAPS_API_KEY): BusMapsAccess {
  // A stored credential is not evidence that the provider has approved access.
  if (process.env.BUSMAPS_STATUS !== "ACTIVE")
    return process.env.BUSMAPS_STATUS === "PENDING_APPROVAL" || !!key?.trim()
      ? "PENDING_APPROVAL"
      : "UNAVAILABLE";
  return key?.trim() ? "ACTIVE" : "UNAVAILABLE";
}
