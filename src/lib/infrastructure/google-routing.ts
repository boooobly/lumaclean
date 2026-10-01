import {
  ROUTING_CONFIG,
  routeTtlSeconds,
  unavailable,
  routeSample,
  type GeoPoint,
  type RouteRequest,
  type RouteResult,
  type RouteMode,
  type RoutingProvider,
  type RouteDetails,
} from "@/lib/domain/routing";
type Json = Record<string, unknown>;
const object = (v: unknown): Json =>
  v && typeof v === "object" ? (v as Json) : {};
const list = (v: unknown): Json[] => (Array.isArray(v) ? v.map(object) : []);
export const seconds = (v: unknown): number | null =>
  typeof v === "string" && /^\d+(\.\d+)?s$/.test(v)
    ? Math.ceil(Number(v.slice(0, -1)))
    : null;
export function routingTelemetry(metric: string, count = 1) {
  console.info(JSON.stringify({ msg: "google_usage", metric, count }));
}
const waypoint = (p: GeoPoint) => ({
  location: { latLng: { latitude: p.latitude, longitude: p.longitude } },
});
export class GoogleRoutesProvider implements RoutingProvider {
  constructor(
    private key = process.env.GOOGLE_MAPS_SERVER_API_KEY,
    private http: typeof fetch = fetch,
    private clock = () => new Date(),
  ) {}
  private async call(method: "matrix" | "details", body: Json, mask: string) {
    if (!this.key) return null;
    routingTelemetry(
      method === "matrix" ? "matrix_requests" : "compute_routes_requests",
    );
    const response = await this.http(
      method === "matrix"
        ? "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix"
        : "https://routes.googleapis.com/directions/v2:computeRoutes",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": this.key,
          "X-Goog-FieldMask": mask,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5000),
        cache: "no-store",
      },
    );
    if (!response.ok) throw new Error("Google routing unavailable");
    return response.json() as Promise<unknown>;
  }
  async getRouteMatrix(
    origins: GeoPoint[],
    destinations: GeoPoint[],
    mode: RouteMode,
    at: string,
    timing: "departure" | "arrival" = "departure",
  ): Promise<RouteResult[][]> {
    if (
      !origins.length ||
      !destinations.length ||
      origins.length * destinations.length > ROUTING_CONFIG.matrixLimit ||
      (timing === "arrival" && mode !== "TRANSIT")
    )
      throw new Error("Invalid bounded matrix");
    const now = this.clock(),
      request = {
        origin: origins[0],
        destination: destinations[0],
        mode,
        at,
        timing,
      };
    const result = origins.map(() =>
      destinations.map(() =>
        unavailable(request, this.key ? "PROVIDER_ERROR" : "UNVERIFIED", now),
      ),
    );
    if (!this.key) return result;
    const sample = routeSample(request),
      timestamp = new Date(sample).getTime();
    if (
      (mode === "TRANSIT" &&
        (timestamp < now.getTime() - 7 * 86400000 ||
          timestamp > now.getTime() + 100 * 86400000)) ||
      (mode === "DRIVE" && timestamp < now.getTime())
    )
      return result;
    try {
      routingTelemetry("matrix_elements", origins.length * destinations.length);
      const data = await this.call(
        "matrix",
        {
          origins: origins.map((p) => ({ waypoint: waypoint(p) })),
          destinations: destinations.map((p) => ({ waypoint: waypoint(p) })),
          travelMode: mode,
          [timing === "arrival" ? "arrivalTime" : "departureTime"]: sample,
          ...(mode === "DRIVE" ? { routingPreference: "TRAFFIC_AWARE" } : {}),
          languageCode: "ru",
          regionCode: "rs",
        },
        "originIndex,destinationIndex,status,condition,duration,distanceMeters,fallbackInfo",
      );
      for (const row of list(data)) {
        const i = Number(row.originIndex ?? 0),
          j = Number(row.destinationIndex ?? 0),
          duration = seconds(row.duration);
        if (!Number.isInteger(i) || !Number.isInteger(j) || !result[i]?.[j])
          continue;
        const good =
          !object(row.status).code &&
          row.condition === "ROUTE_EXISTS" &&
          duration !== null &&
          !row.fallbackInfo;
        result[i][j] = good
          ? {
              status: "VERIFIED",
              durationSeconds: duration,
              distanceMeters: Number.isFinite(row.distanceMeters)
                ? Number(row.distanceMeters)
                : 0,
              sampledAt: sample,
              calculatedAt: now.toISOString(),
              expiresAt: new Date(
                now.getTime() + routeTtlSeconds() * 1000,
              ).toISOString(),
              source: "Google",
            }
          : unavailable(
              request,
              row.condition === "ROUTE_NOT_FOUND"
                ? "NO_ROUTE"
                : "PROVIDER_ERROR",
              now,
            );
      }
    } catch {
      routingTelemetry("errors");
    }
    return result;
  }
  async getTravelTime(request: RouteRequest) {
    if (!request.origin || !request.destination) return unavailable(request);
    return (
      await this.getRouteMatrix(
        [request.origin],
        [request.destination],
        request.mode,
        request.at,
        request.timing,
      )
    )[0][0];
  }
  async getRouteDetails(request: RouteRequest): Promise<RouteDetails> {
    if (!this.key || !request.origin || !request.destination)
      return { result: unavailable(request), steps: [] };
    try {
      const data = object(
        await this.call(
          "details",
          {
            origin: waypoint(request.origin),
            destination: waypoint(request.destination),
            travelMode: request.mode,
            [request.timing === "arrival" ? "arrivalTime" : "departureTime"]:
              request.at,
            ...(request.mode === "DRIVE"
              ? { routingPreference: "TRAFFIC_AWARE" }
              : {}),
            languageCode: "ru",
            regionCode: "rs",
          },
          "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.steps.travelMode,routes.legs.steps.staticDuration,routes.legs.steps.navigationInstruction.instructions,routes.legs.steps.transitDetails.stopDetails,routes.legs.steps.transitDetails.transitLine.nameShort",
        ),
      );
      const route = list(data.routes)[0],
        duration = seconds(route?.duration),
        now = this.clock();
      if (!route || duration === null)
        return { result: unavailable(request, "NO_ROUTE", now), steps: [] };
      return {
        result: {
          status: "VERIFIED",
          durationSeconds: duration,
          distanceMeters: Number(route.distanceMeters ?? 0),
          calculatedAt: now.toISOString(),
          expiresAt: new Date(
            now.getTime() + routeTtlSeconds() * 1000,
          ).toISOString(),
          sampledAt: request.at,
          source: "Google",
        },
        polyline: String(object(route.polyline).encodedPolyline ?? ""),
        steps: list(route.legs)
          .flatMap((leg) =>
            list(leg.steps).map((step) => {
              const transit = object(step.transitDetails),
                stops = object(transit.stopDetails);
              return {
                mode: String(step.travelMode ?? "WALK"),
                durationSeconds: seconds(step.staticDuration) ?? 0,
                line: String(object(transit.transitLine).nameShort ?? ""),
                from: String(object(stops.departureStop).name ?? ""),
                to: String(object(stops.arrivalStop).name ?? ""),
                departure:
                  typeof stops.departureTime === "string"
                    ? stops.departureTime
                    : undefined,
                arrival:
                  typeof stops.arrivalTime === "string"
                    ? stops.arrivalTime
                    : undefined,
                instructions: String(
                  object(step.navigationInstruction).instructions ?? "",
                ),
              };
            }),
          )
          .slice(0, 80),
      };
    } catch {
      routingTelemetry("errors");
      return { result: unavailable(request, "PROVIDER_ERROR"), steps: [] };
    }
  }
}
