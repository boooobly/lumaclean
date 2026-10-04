import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
export function evaluateBenchmark(rows, status) {
  const eligible = rows.filter(
    (r) =>
      ["LIVE", "WALKING"].includes(r.quality) &&
      r.reference?.permissionConfirmed === true &&
      r.reference.source &&
      r.reference.evidence &&
      Number.isFinite(r.reference.minutes) &&
      r.reference.minutes > 0,
  );
  const errors = eligible
      .map((r) => Math.abs(r.durationSeconds / 60 - r.reference.minutes))
      .sort((a, b) => a - b),
    n = errors.length;
  const median = n
      ? (errors[Math.floor((n - 1) / 2)] + errors[Math.floor(n / 2)]) / 2
      : null,
    within = n ? errors.filter((e) => e <= 15).length / n : null;
  const complete =
    n === rows.length &&
    rows.length >= 90 &&
    new Set(rows.map((r) => r.pair)).size >= 30;
  const dataSafe =
    status.routingReadiness === "LIVE" &&
    status.engine?.healthy === true &&
    status.static?.valid === true &&
    status.realtime?.usable === true &&
    status.realtime?.licenseConfirmed === true;
  return {
    status:
      complete && dataSafe && median <= 10 && within >= 0.8
        ? "PASSED"
        : "BLOCKED",
    measurements: rows.length,
    independentReferences: n,
    medianAbsoluteErrorMinutes: median,
    within15Ratio: within,
    qualityCounts: rows.reduce(
      (a, r) => ((a[r.quality] = (a[r.quality] ?? 0) + 1), a),
      {},
    ),
    blockers: [
      ...(!dataSafe ? ["DATA_NOT_PRODUCTION_SAFE"] : []),
      ...(!complete ? ["INDEPENDENT_REFERENCE_COVERAGE_INCOMPLETE"] : []),
      ...(median !== null && median > 10 ? ["MEDIAN_ERROR_OVER_10_MIN"] : []),
      ...(within !== null && within < 0.8
        ? ["UNDER_80_PERCENT_WITHIN_15_MIN"]
        : []),
    ],
  };
}
async function main() {
  const input = JSON.parse(
    await readFile("docs/routing/belgrade-pairs.json", "utf8"),
  );
  const url = process.env.LUMACLEAN_ROUTING_URL,
    token = process.env.LUMACLEAN_ROUTING_TOKEN;
  if (!url || new URL(url).protocol !== "https:" || !token)
    throw Error("SERVER_ROUTING_CONFIG_REQUIRED");
  const call = async (path, body) => {
    const r = await fetch(new URL(path, url), {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) throw Error("GATEWAY_" + r.status);
    return r.json();
  };
  let references = [];
  if (process.env.ROUTING_REFERENCE_FILE)
    references = JSON.parse(
      await readFile(process.env.ROUTING_REFERENCE_FILE, "utf8"),
    );
  const rows = [];
  for (const at of input.departures) {
    for (const pair of input.pairs) {
      const a = input.points[pair.origin],
        b = input.points[pair.destination];
      const point = (p) => ({ latitude: p.latitude, longitude: p.longitude });
      const result = await call("/route", {
        origin: point(a),
        destination: point(b),
        mode: "TRANSIT",
        at,
        timing: "departure",
      });
      rows.push({
        pair: pair.id,
        origin: a.name,
        destination: b.name,
        at,
        quality: result.quality,
        durationSeconds: result.durationSeconds,
        dataVersion: result.dataVersion,
        reference:
          references.find((r) => r.pair === pair.id && r.at === at) ?? null,
      });
    }
  }
  const status = await call("/datasets/status"),
    summary = evaluateBenchmark(rows, status);
  const report = {
    checkedAt: new Date().toISOString(),
    service: url,
    source: input.source,
    datasetStatus: status,
    summary,
    rows,
  };
  await writeFile(
    "docs/routing/benchmark-preview.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  await writeFile(
    "docs/routing/reference-template.json",
    JSON.stringify(
      rows.map((r) => ({
        pair: r.pair,
        at: r.at,
        minutes: null,
        source: "",
        evidence: "",
        permissionConfirmed: false,
        collectedAt: null,
      })),
      null,
      2,
    ) + "\n",
  );
  console.log(JSON.stringify(summary));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main();
