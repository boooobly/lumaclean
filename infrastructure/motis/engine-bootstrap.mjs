import { createServer } from "node:http";
import { spawn } from "node:child_process";
import {
  readFile,
  writeFile,
  mkdir,
  rename,
  stat,
  readdir,
  rm,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import { stringify } from "yaml";
import {
  SOURCES,
  RT_URL,
  OSM_URL,
  fetchBounded,
  validateGtfs,
  digest,
  decodeRt,
  rtMetrics,
} from "./datasets.mjs";
const root = resolve(process.env.DATA_DIR ?? "/data"),
  binary = process.env.MOTIS_BINARY ?? "/motis";
await mkdir(root, { recursive: true });
let child = null,
  active = null,
  indexes = [],
  rt = { status: "UNAVAILABLE", usable: false, licenseConfirmed: false },
  lastUpdateError = null,
  busy = false;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const maxStaticAgeDays = Number(process.env.MAX_STATIC_AGE_DAYS ?? 365),
  rtConfig = {
    maxAgeSeconds: Number(process.env.RT_MAX_AGE_SECONDS ?? 120),
    minMatchRatio: Number(process.env.RT_MIN_MATCH_RATIO ?? 0.8),
    licenseConfirmed: process.env.RT_LICENSE_CONFIRMED === "true",
  };
function publicStatus() {
  const now = Date.now(),
    freshAge = rt.timestamp ? now / 1000 - rt.timestamp : null;
  const fresh =
    freshAge !== null && freshAge >= -60 && freshAge <= rtConfig.maxAgeSeconds;
  const datasets = (active?.datasets ?? []).map((x) => ({
    ...x,
    ageDays: Math.floor((now - Date.parse(x.publishedAt)) / 86400000),
  }));
  const staticValid =
    datasets.length === SOURCES.length &&
    datasets.every(
      (x) =>
        x.valid &&
        x.validUntil >= new Date(now).toISOString().slice(0, 10) &&
        x.ageDays <= maxStaticAgeDays,
    );
  return {
    engine: {
      healthy: !!child && !child.killed && !!active,
      version: "2.11.3",
    },
    osm: active?.osm ?? null,
    static: { valid: staticValid, datasets },
    realtime: {
      ...rt,
      freshnessSeconds: freshAge,
      usable: rt.usable && fresh,
      status: rt.status === "FRESH" && !fresh ? "STALE" : rt.status,
    },
    dataVersion: active?.dataVersion ?? "unprepared",
    activeAt: active?.activeAt ?? null,
    update: { busy, lastError: lastUpdateError },
    thresholds: { ...rtConfig, maxStaticAgeDays },
    attributions: [
      {
        name: "OpenStreetMap contributors",
        url: "https://www.openstreetmap.org/copyright",
      },
      {
        name: "City of Belgrade Secretariat for Public Transport",
        url: "https://data.gov.rs/sr/terms/",
      },
    ],
  };
}
async function probe(port) {
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 90; i++) {
    try {
      const h = await fetch(base + "/api/v1/health", {
        signal: AbortSignal.timeout(2000),
      });
      if (h.ok) {
        const g = await fetch(
            base + "/api/v1/geocode?text=Terazije&numResults=3",
            { signal: AbortSignal.timeout(5000) },
          ),
          r = await fetch(
            base + "/api/v1/reverse-geocode?place=44.8125,20.4612&numResults=3",
            { signal: AbortSignal.timeout(5000) },
          ),
          w = await fetch(
            base +
              "/api/v6/plan?fromPlace=44.8125,20.4612&toPlace=44.815,20.460&transitModes=&directModes=WALK&timeout=5",
            { signal: AbortSignal.timeout(8000) },
          );
        if (
          g.ok &&
          r.ok &&
          w.ok &&
          (await g.json()).length &&
          (await w.json()).direct?.length
        )
          return;
      }
    } catch {
      /* Wait for prepared indexes. */
    }
    await sleep(1000);
  }
  throw Error("CANDIDATE_HEALTH_FAILED");
}
async function startPrepared(manifest) {
  const port = manifest.port,
    c = spawn(binary, ["server", "--data", manifest.dataDir], {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
  c.stdout.on("data", (b) => {
    if (/listening/i.test(b.toString())) console.log("engine_listening");
  });
  c.stderr.on("data", () => {});
  c.once("exit", () => {
    if (child === c) {
      child = null;
      console.log("engine_exit");
    }
  });
  try {
    await probe(port);
    return c;
  } catch (e) {
    c.kill();
    throw e;
  }
}
async function update() {
  if (busy) return;
  busy = true;
  try {
    const cachedOsm = join(root, "osm.pbf");
    let osm = active?.osm;
    let osmBytes;
    const osmExists = await stat(cachedOsm).catch(() => null);
    if (
      !osmExists ||
      !osm ||
      Date.now() - Date.parse(osm.downloadedAt) > 7 * 86400000
    ) {
      const d = await fetchBounded(OSM_URL, 350 * 1024 * 1024, 180000);
      osmBytes = d.bytes;
      await writeFile(cachedOsm + ".candidate", osmBytes);
      await rename(cachedOsm + ".candidate", cachedOsm);
      osm = {
        sha256: digest(osmBytes),
        version: d.modified ?? digest(osmBytes).slice(0, 16),
        downloadedAt: new Date().toISOString(),
        source: OSM_URL,
        license: "ODbL-1.0",
      };
    }
    const validated = [];
    for (const source of SOURCES) {
      const download = await fetchBounded(source.url, 32 * 1024 * 1024, 60000);
      validated.push(
        await validateGtfs(download.bytes, {
          ...source,
          publishedAt: download.modified
            ? new Date(download.modified).toISOString()
            : source.publishedAt,
        }),
      );
    }
    const configVersion =
      "2.11.3:rt=" +
      String(
        process.env.RT_PREVIEW_ENABLED === "true" || rtConfig.licenseConfirmed,
      );
    const same =
      active &&
      active.configVersion === configVersion &&
      active.osm.sha256 === osm.sha256 &&
      validated.every((v) =>
        active.datasets.some(
          (x) => x.id === v.metadata.id && x.sha256 === v.metadata.sha256,
        ),
      ) &&
      Date.now() - Date.parse(active.activeAt) < 7 * 86400000;
    if (same) {
      indexes = validated.map((v) => v.index);
      if (!child) child = await startPrepared(active);
      lastUpdateError = null;
      return;
    }
    const id = digest(
        Buffer.from(
          JSON.stringify({
            configVersion,
            osm: osm.sha256,
            gtfs: validated.map((v) => v.metadata.sha256),
            day: new Date().toISOString().slice(0, 10),
          }),
        ),
      ),
      folder = join(root, "versions", id);
    await mkdir(folder, { recursive: true });
    for (const v of validated)
      await writeFile(join(folder, v.metadata.id + ".zip"), v.bytes);
    const port = active?.port === 8091 ? 8092 : 8091,
      dataDir = join(folder, "prepared");
    const config = {
      server: {
        host: "127.0.0.1",
        port,
        n_threads: 2,
        when_unhealthy_return_error: false,
        data_attribution_link: "https://data.gov.rs/sr/terms/",
      },
      osm: cachedOsm,
      street_routing: true,
      geocoding: true,
      reverse_geocoding: true,
      osr_footpath: true,
      timetable: {
        first_day: "TODAY",
        num_days: 90,
        with_shapes: true,
        update_interval: 60,
        http_timeout: 10,
        datasets: Object.fromEntries(
          validated.map((v) => [
            v.metadata.id,
            {
              path: join(folder, v.metadata.id + ".zip"),
              extend_calendar: false,
              ...(process.env.RT_PREVIEW_ENABLED === "true" ||
              rtConfig.licenseConfirmed
                ? { rt: [{ url: RT_URL }] }
                : {}),
            },
          ]),
        ),
      },
      limits: {
        routing_max_timeout_seconds: 8,
        plan_max_results: 3,
        geocode_max_suggestions: 5,
        reverse_geocode_max_results: 5,
        street_routing_max_direct_seconds: 7200,
        street_routing_max_prepost_transit_seconds: 1800,
      },
      logging: { log_level: "info" },
    };
    const configPath = join(folder, "config.yml");
    await writeFile(configPath, stringify(config));
    console.log("dataset_import_start");
    await new Promise((ok, fail) => {
      const p = spawn(
        binary,
        ["import", "--config", configPath, "--data", dataDir],
        { stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
      );
      p.stdout.on("data", () => {});
      p.stderr.on("data", () => {});
      p.once("error", fail);
      p.once("exit", (code) =>
        code === 0 ? ok() : fail(Error("IMPORT_FAILED")),
      );
    });
    const manifest = {
      configVersion,
      dataVersion: id,
      dataDir,
      port,
      osm,
      datasets: validated.map((v) => v.metadata),
      activeAt: new Date().toISOString(),
    };
    const next = await startPrepared(manifest),
      old = child,
      previous = active;
    try {
      await writeFile(
        join(root, "current.json.candidate"),
        JSON.stringify(manifest),
      );
      await rename(
        join(root, "current.json.candidate"),
        join(root, "current.json"),
      );
    } catch (e) {
      next.kill();
      throw e;
    }
    child = next;
    active = manifest;
    indexes = validated.map((v) => v.index);
    if (old) old.kill();
    for (const name of await readdir(join(root, "versions"))) {
      const target = resolve(root, "versions", name);
      if (
        /^[a-f0-9]{64}$/.test(name) &&
        name !== manifest.dataVersion &&
        name !== previous?.dataVersion &&
        target.startsWith(resolve(root, "versions") + "/")
      )
        await rm(target, { recursive: true, force: true });
    }
    lastUpdateError = null;
    console.log("dataset_activated " + id.slice(0, 16));
  } catch (e) {
    lastUpdateError = String(e.message)
      .replace(/https?:\/\/\S+/g, "[source]")
      .slice(0, 80);
    console.log("dataset_update_failed " + lastUpdateError);
  } finally {
    busy = false;
  }
}
async function refreshRt() {
  try {
    const downloaded = await fetchBounded(RT_URL, 8 * 1024 * 1024, 8000);
    rt = rtMetrics(decodeRt(downloaded.bytes), indexes, rtConfig);
  } catch (e) {
    rt = {
      status: "UNAVAILABLE",
      usable: false,
      licenseConfirmed: rtConfig.licenseConfirmed,
      error: String(e.message).slice(0, 60),
    };
  }
}
const allowed = new Set([
  "/api/v1/health",
  "/api/v1/geocode",
  "/api/v1/reverse-geocode",
  "/api/v6/plan",
]);
createServer(async (req, res) => {
  const url = new URL(req.url, "http://internal");
  if (url.pathname === "/internal/datasets") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(publicStatus()));
    return;
  }
  if (url.pathname === "/health") {
    res.writeHead(active && child ? 200 : 503, {
      "Content-Type": "application/json",
    });
    res.end(
      JSON.stringify({
        healthy: !!active && !!child,
        phase: busy ? "PREPARING" : active ? "READY" : "UNPREPARED",
      }),
    );
    return;
  }
  if (
    req.method !== "GET" ||
    !allowed.has(url.pathname) ||
    req.url.length > 4000
  ) {
    res.writeHead(404);
    res.end();
    return;
  }
  if (!active || !child) {
    res.writeHead(503);
    res.end();
    return;
  }
  try {
    const response = await fetch(
      `http://127.0.0.1:${active.port}${url.pathname}${url.search}`,
      { signal: AbortSignal.timeout(12000) },
    );
    res.writeHead(response.status, { "Content-Type": "application/json" });
    res.end(await response.text());
  } catch {
    res.writeHead(503);
    res.end("{}");
  }
}).listen(Number(process.env.PORT ?? 8080), "::");
try {
  const saved = JSON.parse(await readFile(join(root, "current.json"), "utf8"));
  const restored = await startPrepared(saved);
  child = restored;
  active = saved;
} catch {
  /* First import or failed restore: validated updater retains files. */
}
void update().then(refreshRt);
setInterval(() => void update(), 86400000);
setInterval(() => void refreshRt(), 30000);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    child?.kill();
    process.exit(0);
  });
