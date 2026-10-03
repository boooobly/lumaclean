export type GeoPoint = {
  latitude: number;
  longitude: number;
  placeId?: string | null;
};
export type RouteMode = "TRANSIT" | "DRIVE" | "WALK";
export type RouteQuality = "LIVE" | "WALKING" | "FALLBACK_80" | "UNRESOLVED";
export type AddressMatch = {
  id: string;
  displayAddress: string;
  latitude: number;
  longitude: number;
};
export type RouteRequest = {
  origin: GeoPoint | null;
  destination: GeoPoint | null;
  mode: RouteMode;
  at: string;
  timing?: "departure" | "arrival";
};
export type RouteResult = {
  status: "VERIFIED" | "UNVERIFIED" | "PROVIDER_ERROR" | "NO_ROUTE" | "STALE";
  durationSeconds: number | null;
  distanceMeters: number | null;
  calculatedAt: string;
  expiresAt: string;
  sampledAt: string;
  source: "Google" | "MOTIS";
  quality?: RouteQuality;
  dataVersion?: string;
  reason?: string | null;
};
export type RouteStep = {
  mode: string;
  durationSeconds: number;
  line?: string;
  from?: string;
  to?: string;
  departure?: string;
  arrival?: string;
  instructions?: string;
};
export type RouteDetails = {
  result: RouteResult;
  steps: RouteStep[];
  polyline?: string;
  polylines?: string[];
  geometries?: { points: string; precision: number }[];
};
export interface RoutingProvider {
  searchAddress?(query: string): Promise<AddressMatch[]>;
  reverseGeocode?(point: GeoPoint): Promise<AddressMatch[]>;
  cacheContext?(): Promise<{ dataVersion: string; liveReady: boolean }>;
  getTravelTime(request: RouteRequest): Promise<RouteResult>;
  getRouteMatrix(
    origins: GeoPoint[],
    destinations: GeoPoint[],
    mode: RouteMode,
    at: string,
    timing?: "departure" | "arrival",
  ): Promise<RouteResult[][]>;
  getRouteDetails(request: RouteRequest): Promise<RouteDetails>;
}
export const ROUTING_CONFIG = {
  bucketMinutes: 15,
  ttlSeconds: 600,
  matrixLimit: 100,
  maxElements: 1200,
  maxRequests: 32,
  deadlineMs: 18000,
  candidates: 12,
  beamWidth: 32,
  maxNodes: 3000,
  maxOrders: 100,
  maxCleaners: 20,
  proposalSeconds: 600,
} as const;
export const SCORE_WEIGHTS = {
  travel: 100,
  idle: 1,
  imbalance: 2,
  movedFlexible: 300,
  changedAssignment: 100,
} as const;
export function routeTtlSeconds() {
  const value = Number(
    process.env.GOOGLE_ROUTE_CACHE_TTL_SECONDS ?? ROUTING_CONFIG.ttlSeconds,
  );
  return Number.isFinite(value)
    ? Math.max(30, Math.min(1800, Math.floor(value)))
    : ROUTING_CONFIG.ttlSeconds;
}
export function pointKey(p: GeoPoint | null) {
  return p ? `${p.latitude.toFixed(7)},${p.longitude.toFixed(7)}` : "missing";
}
export function routeSample(request: RouteRequest) {
  const unit = ROUTING_CONFIG.bucketMinutes * 60000;
  const value = new Date(request.at).getTime() / unit;
  return new Date(
    (request.timing === "arrival" ? Math.floor(value) : Math.ceil(value)) *
      unit,
  ).toISOString();
}
export function routeKey(r: RouteRequest) {
  return [
    process.env.LUMACLEAN_ROUTING_PROVIDER === "GOOGLE"
      ? "google-v2"
      : "motis-v1",
    pointKey(r.origin),
    pointKey(r.destination),
    r.mode,
    r.timing ?? "departure",
    routeSample(r),
    ...(process.env.LUMACLEAN_ROUTING_PROVIDER === "GOOGLE" ? [] : [r.at]),
  ].join("|");
}
export function unavailable(
  r: RouteRequest,
  status: RouteResult["status"] = "UNVERIFIED",
  now = new Date(),
): RouteResult {
  return {
    status,
    durationSeconds: null,
    distanceMeters: null,
    sampledAt: routeSample(r),
    calculatedAt: now.toISOString(),
    expiresAt: now.toISOString(),
    source: "Google",
  };
}
export const routeUsable = (r: RouteResult | undefined, now = Date.now()) =>
  Boolean(
    r?.status === "VERIFIED" &&
      r.durationSeconds !== null &&
      new Date(r.expiresAt).getTime() > now,
  );
export const routeLabels = {
  VERIFIED: "Маршрут проверен",
  STALE: "Маршрут устарел",
  UNVERIFIED: "Маршрут не проверен",
  PROVIDER_ERROR: "Расчёт дороги недоступен",
  NO_ROUTE: "Маршрут не найден",
} as const;
export const qualityLabels = {
  LIVE: "Транспорт · LIVE",
  WALKING: "Пешком",
  FALLBACK_80: "Дорога · резерв 80 мин",
  UNRESOLVED: "Подтвердите координаты",
} as const;

export const geo = (
  latitude: unknown,
  longitude: unknown,
  placeId?: string | null,
): GeoPoint | null =>
  latitude !== null &&
  latitude !== undefined &&
  longitude !== null &&
  longitude !== undefined &&
  Number.isFinite(Number(latitude)) &&
  Number.isFinite(Number(longitude))
    ? { latitude: Number(latitude), longitude: Number(longitude), placeId }
    : null;
