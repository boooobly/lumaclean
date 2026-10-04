import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import {
  authorized,
  Limits,
  pointSchema,
  routeSchema,
  matrixSchema,
  selectJourney,
  transitReady,
  transitReadyFor,
} from "./core.mjs";
export function createGateway({
  token = process.env.ROUTING_TOKEN,
  motisUrl = process.env.MOTIS_URL,
  http = fetch,
  clock = () => Date.now(),
} = {}) {
  if (!token || token.length < 32) throw Error("SERVER_TOKEN_REQUIRED");
  const base = new URL(motisUrl);
  if (
    base.protocol !== "http:" ||
    !(
      /\.railway\.internal$/.test(base.hostname) ||
      ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)
    )
  )
    throw Error("PRIVATE_MOTIS_REQUIRED");
  const requestLimits = new Limits({ concurrency: 8, perMinute: 240 }),
    engineLimits = new Limits({ concurrency: 4, perMinute: 600 }),
    cache = new Map();
  let snapshot = null,
    snapshotAt = 0,
    pendingHealth = null;
  async function engine(path, query = {}) {
    if (!engineLimits.enter(clock())) throw Error("ENGINE_BUSY");
    try {
      const u = new URL(path, base);
      for (const [k, v] of Object.entries(query))
        u.searchParams.set(k, String(v));
      const r = await http(u, {
        signal: AbortSignal.timeout(8000),
        redirect: "error",
      });
      if (!r.ok) throw Error("ENGINE_UNAVAILABLE");
      const text = await r.text();
      if (text.length > 1024 * 1024) throw Error("BOUNDED_RESPONSE");
      return JSON.parse(text);
    } finally {
      engineLimits.leave();
    }
  }
  async function health() {
    if (snapshot && clock() - snapshotAt < 15000) return snapshot;
    if (pendingHealth) return pendingHealth;
    pendingHealth = engine("/internal/datasets")
      .catch(() => ({
        engine: { healthy: false },
        static: { valid: false, datasets: [] },
        realtime: {
          status: "UNAVAILABLE",
          usable: false,
          licenseConfirmed: false,
        },
        dataVersion: "offline",
      }))
      .then((s) => {
        snapshot = s;
        snapshotAt = clock();
        return s;
      })
      .finally(() => {
        pendingHealth = null;
      });
    return pendingHealth;
  }
  async function route(r, deadline = clock() + 11000) {
    const s = await health(),
      ready = transitReadyFor(s, r, clock()),
      key = JSON.stringify([r, s.dataVersion, ready]);
    const cached = cache.get(key);
    if (
      cached &&
      Date.parse(cached.result.expiresAt) > clock() &&
      (cached.result.quality !== "LIVE" || ready)
    )
      return cached;
    let data = null;
    if (
      s.engine?.healthy &&
      r.origin &&
      r.destination &&
      r.mode !== "DRIVE" &&
      clock() < deadline
    ) {
      try {
        data = await engine("/api/v6/plan", {
          fromPlace: `${r.origin.latitude},${r.origin.longitude}`,
          toPlace: `${r.destination.latitude},${r.destination.longitude}`,
          time: r.at,
          arriveBy: r.timing === "arrival",
          transitModes: ready && r.mode === "TRANSIT" ? "TRANSIT" : "",
          directModes: "WALK",
          numItineraries: 2,
          searchWindow: 900,
          maxDirectTime: 7200,
          timeout: 6,
        });
      } catch {
        /* Explicit 80-minute fallback or unresolved walking. */
      }
    }
    const value = selectJourney(r, s, data, clock());
    if (cache.size >= 1000) cache.delete(cache.keys().next().value);
    cache.set(key, value);
    return value;
  }
  const server = createServer(async (req, res) => {
    const reply = (code, body) => {
      res.writeHead(code, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(body));
    };
    const url = new URL(req.url, "http://gateway");
    if (url.pathname === "/health" && req.method === "GET") {
      reply(200, { ok: true, service: "routing-gateway" });
      return;
    }
    if (!authorized(req.headers.authorization, token)) {
      reply(401, { error: "UNAUTHORIZED" });
      return;
    }
    if (!requestLimits.enter(clock())) {
      reply(429, { error: "RATE_OR_CONCURRENCY_LIMIT" });
      return;
    }
    try {
      if (
        req.headers["content-length"] &&
        Number(req.headers["content-length"]) > 16384
      ) {
        reply(413, { error: "BOUNDED_BODY" });
        return;
      }
      if (req.url.length > 2000) throw Error("BOUNDED_URL");
      if (url.pathname === "/datasets/status" && req.method === "GET") {
        const s = await health(),
          { usableTripIds, usableTrips, ...metrics } = s.realtime ?? {};
        void usableTripIds;
        void usableTrips;
        reply(200, {
          ...s,
          realtime: {
            ...metrics,
            freshnessSeconds: metrics.timestamp
              ? clock() / 1000 - metrics.timestamp
              : null,
          },
          routingReadiness: transitReady(s, clock()) ? "LIVE" : "FALLBACK_80",
          map: { provider: "MapLibre/OpenFreeMap", required: false },
        });
        return;
      }
      if (url.pathname === "/geocode" && req.method === "GET") {
        const q = url.searchParams.get("q") ?? "";
        if (q.length < 3 || q.length > 200) throw Error("INVALID_QUERY");
        const data = await engine("/api/v1/geocode", {
          text: q,
          numResults: 5,
          place: "44.8125,20.4612",
          min: "44.2,19.9",
          max: "45.2,21.0",
        });
        reply(200, {
          results: (Array.isArray(data) ? data : [])
            .filter(
              (x) =>
                pointSchema.safeParse({ latitude: x.lat, longitude: x.lon })
                  .success,
            )
            .slice(0, 5)
            .map((x) => ({
              id: x.id,
              displayAddress: [
                x.name,
                x.street !== x.name ? x.street : null,
                x.houseNumber,
                ...(x.areas ?? []).map((a) => a.name),
              ]
                .filter(Boolean)
                .join(", ")
                .slice(0, 500),
              latitude: x.lat,
              longitude: x.lon,
            })),
          attribution: "OpenStreetMap contributors",
        });
        return;
      }
      if (url.pathname === "/reverse-geocode" && req.method === "GET") {
        const p = pointSchema.parse({
          latitude: Number(url.searchParams.get("latitude")),
          longitude: Number(url.searchParams.get("longitude")),
        });
        const data = await engine("/api/v1/reverse-geocode", {
          place: `${p.latitude},${p.longitude}`,
          numResults: 3,
        });
        reply(200, {
          results: (Array.isArray(data) ? data : []).slice(0, 3).map((x) => ({
            id: x.id,
            displayAddress: [x.name, x.street, x.houseNumber]
              .filter(Boolean)
              .join(", "),
            latitude: x.lat,
            longitude: x.lon,
          })),
        });
        return;
      }
      if (
        req.method !== "POST" ||
        !["/route", "/route-details", "/matrix"].includes(url.pathname)
      ) {
        reply(404, { error: "OPERATION_NOT_ALLOWED" });
        return;
      }
      if (!String(req.headers["content-type"]).startsWith("application/json"))
        throw Error("JSON_REQUIRED");
      let size = 0,
        chunks = [];
      for await (const c of req) {
        size += c.length;
        if (size > 16384) throw Error("BOUNDED_BODY");
        chunks.push(c);
      }
      const body = JSON.parse(Buffer.concat(chunks));
      if (url.pathname === "/matrix") {
        const m = matrixSchema.parse(body),
          deadline = clock() + 11000;
        const rows = [];
        for (const origin of m.origins) {
          const row = [];
          for (let i = 0; i < m.destinations.length; i += 4) {
            row.push(
              ...(await Promise.all(
                m.destinations.slice(i, i + 4).map((destination) =>
                  route(
                    {
                      origin,
                      destination,
                      mode: m.mode,
                      at: m.at,
                      timing: m.timing,
                    },
                    deadline,
                  ).then((x) => x.result),
                ),
              )),
            );
          }
          rows.push(row);
        }
        reply(200, { rows });
      } else {
        const r = routeSchema.parse(body),
          details = await route(r);
        reply(200, url.pathname === "/route" ? details.result : details);
      }
    } catch (e) {
      reply(
        e.message === "ENGINE_UNAVAILABLE" || e.message === "ENGINE_BUSY"
          ? 503
          : 400,
        {
          error:
            e.message === "ENGINE_BUSY"
              ? "ENGINE_BUSY"
              : "REQUEST_OR_PROVIDER_UNAVAILABLE",
        },
      );
    } finally {
      requestLimits.leave();
    }
  });
  return server;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  createGateway().listen(Number(process.env.PORT ?? 8080), "::");
  console.log("routing_gateway_started");
}
