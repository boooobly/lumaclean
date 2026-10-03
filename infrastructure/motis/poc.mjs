// Public landmarks only. Static transit output is research data, never a LIVE result.
const base = "http://127.0.0.1:8080";
const get = async (path) => {
  const r = await fetch(base + path, { signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw Error("POC_HTTP_" + r.status);
  return r.json();
};
const common = {
  fromPlace: "44.8125,20.4612",
  toPlace: "44.826066,20.397835",
  directModes: "WALK",
  numItineraries: 2,
  timeout: 6,
};
const routes = [];
for (const time of [
  "2026-10-05T07:00:00+02:00",
  "2026-10-05T13:00:00+02:00",
  "2026-10-05T18:00:00+02:00",
]) {
  const data = await get(
    "/api/v6/plan?" +
      new URLSearchParams({ ...common, time, transitModes: "TRANSIT" }),
  );
  routes.push({
    time,
    quality: "STATIC_RESEARCH_ONLY",
    itineraries:
      data.itineraries?.map((i) => ({
        durationSeconds: i.duration,
        startTime: i.startTime,
        endTime: i.endTime,
        legs: i.legs?.map((l) => ({
          mode: l.mode,
          realTime: l.realTime ?? false,
        })),
      })) ?? [],
    walking: data.direct?.map((i) => ({ durationSeconds: i.duration })) ?? [],
  });
}
const data = await get("/internal/datasets");
console.log(
  JSON.stringify({
    checkedAt: new Date().toISOString(),
    version: data.engine.version,
    healthy: data.engine.healthy,
    rt: data.realtime.status,
    rtLicenseConfirmed: data.realtime.licenseConfirmed,
    rtIngestion:
      "NOT_ENABLED: source unavailable and compatibility/terms unverified",
    routes,
  }),
);
