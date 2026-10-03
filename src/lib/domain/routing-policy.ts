import defaults from "../../../infrastructure/routing-gateway/routing-policy.json";
export const DEFAULT_FALLBACK_TRAVEL_MINUTES = defaults.fallbackTravelMinutes;
export function fallbackTravelMinutes(value?: unknown) {
  const minutes = Number(value ?? DEFAULT_FALLBACK_TRAVEL_MINUTES);
  return Number.isInteger(minutes) && minutes >= 5 && minutes <= 240
    ? minutes : DEFAULT_FALLBACK_TRAVEL_MINUTES;
}
