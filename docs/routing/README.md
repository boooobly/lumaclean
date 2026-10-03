# LumaClean routing Preview — 3 October 2026

The implementation is on `codex/admin-motis-routing`, based on `b27ee64` (`codex/admin-live-readiness`). Railway and Vercel Preview use MOTIS. Production has **not** been migrated, deployed, promoted or switched. Website AI remains **SHADOW**. Accuracy approval is **BLOCKED**; infrastructure readiness is not approval to activate production or AUTO.

## Data and permission evidence

| Dataset | Observed version / age | Permission / operational status |
| --- | --- | --- |
| [Official city GTFS](https://data.gov.rs/sr/datasets/r/729be9a1-7ed9-453d-9a3d-68fa30f07529) | Feed 24, published 31 October 2025; 337 days old | SODL, reusable with attribution; structurally validated, declared validity ends 31 December 2026 |
| [Official suburban GTFS](https://data.gov.rs/sr/datasets/r/60f82229-16c7-4939-961b-2c24873d3e06) | Feed 7, published 1 July 2025; 458 days old | SODL, reusable with attribution; structurally valid but exceeds configured 365-day LIVE age limit; ends 31 December 2026 |
| [Serbia OSM extract](https://download.geofabrik.de/europe/serbia-latest.osm.pbf) | 3 October 2026 snapshot | [ODbL 1.0 / OpenStreetMap attribution](https://www.openstreetmap.org/copyright); processed locally in private engine |
| [BusLogic RT endpoint](https://rt.buslogic.baguette.pirnet.si/beograd/rt.pb) | Repeated HTTP 500, HTML rather than protobuf | Terms unconfirmed, freshness / TripUpdates / VehiclePositions / ID compatibility / actual coverage unknown. Monitoring only; not ingested or enabled for LIVE |

GTFS publisher attribution: City of Belgrade, Secretariat for Public Transport, through Serbia's open-data portal. [SODL terms](https://data.gov.rs/sr/terms/) permit commercial reuse with source, public body, download date, link and modifications attribution. Downloads on 3 October 2026 are recorded with hashes, source URLs and versions in `benchmark-preview.json` and gateway dataset status. CSV quoting was normalized in two damaged tables per feed; IDs, timetables and service calendars were preserved. Empty rows are ignored. Calendar dates were not extended; declared feed expiry takes precedence over longer nominal calendar ranges.

Validated city feed: 241 routes, 3,266 stops, 87,474 trips and 2,300,609 stop times. Suburban: 304 routes, 2,811 stops, 9,852 trips and 266,414 stop times. References between trip/route/stop tables passed validation.

The [Transitous Serbia registry](https://github.com/public-transport/transitous/blob/main/feeds/rs.json) lists the RT proxy alongside these static feeds. Listing alone does not establish compatibility or permission. The [public Transitous API](https://transitous.org/api/) forbids commercial use and is not used by LumaClean. A newer September 2026 [BusMaps listing](https://busmaps.com/en/serbia/Republic-of-Serbia/beograd) has custom access/licensing; permission was not established and its data was not imported. No newer unrestricted, validated Belgrade GTFS was found in this investigation.

## Deployed Preview architecture

[Railway project](https://railway.com/project/11c95a43-6a82-4441-a4da-61257023df98), explicit environment `preview` (`e9ca34ea-b5cf-4a65-b8c0-250fd6354fbc`):

- `motis`: MOTIS **2.11.3**, private Railway network only, no public domain; 5,000 MB persistent volume mounted at `/data`. Native engine is behind a private bootstrap wrapper. Latest deployment `22652829-dfa8-4488-a05e-2808fad1842c` succeeded.
- `routing-gateway`: [public health](https://routing-gateway-preview.up.railway.app/health), HTTPS, server-token authentication on every operation except a minimal health response. Latest deployment `fd3f5af3-fbbe-42d0-81f4-e8001ec55122` succeeded.
- Vercel [application Preview](https://lumaclean-jf0w7v5pj-vladislavs-projects-0eae0ea3.vercel.app/admin/settings): provider `MOTIS`, Google adapter disabled. Protected Preview access remains enabled.

Only gateway allowlisted operations are exposed: health, datasets status, geocode, reverse-geocode, route, route-details and matrix. Bounds: Belgrade region, 100 matrix cells, 16 KB request body, 1 MB upstream response, timeouts, rate and concurrency limits, bounded in-memory caches. Requests and precise coordinates are not logged. URL and token are server-side `LUMACLEAN_ROUTING_URL` / `LUMACLEAN_ROUTING_TOKEN`; never `NEXT_PUBLIC` and never included in this report.

`RoutingProvider` remains the domain boundary. CRM, Calendar, AI tools, AvailabilityService and the existing ScheduleOptimizer use it; no LumaClean optimizer runs in the gateway. Google can only be selected with both explicit provider selection and explicit enablement.

## Quality, coordinates and cache

- `LIVE`: healthy engine, current validated static data, confirmed RT permission, RT age at most 120 seconds, default minimum trip/route/stop match 80%, usable TripUpdates, and a matching actual realtime leg, source and service date. Cancelled/looped-calendar/static-only journeys do not qualify. The requested date must fall within dataset validity.
- `WALKING`: verified walking journey, independent of RT. For transit requests, a walk up to 80 minutes can be used; longer walks use the owner-approved reserve instead. Explicit walking requests have a bounded 120-minute maximum and become unresolved when unavailable.
- `FALLBACK_80`: exactly 4,800 seconds for unverified transport or provider failure. It is the owner's reserve, not an observed transit or driving ETA. Static research ETA is never labelled LIVE.
- `UNRESOLVED`: missing, unconfirmed or out-of-region coordinates block automatic booking. Free-text address is not a routing input.

MOTIS autocomplete requires explicit candidate selection. MapLibre shows a draggable pin; numeric coordinate fields also work if map tiles fail. A separate user checkbox and confirmation creates a server-signed proof; saving the CRM/cleaner form stores coordinates and the confirmation flag. Editing address/pin invalidates confirmation. Existing records remain unconfirmed until reviewed; the migration does not silently approve old coordinates.

Travel and business buffer are separate: home to the first job adds **no 30-minute buffer**; subsequent jobs require previous end + travel + 30 minutes. Fallback therefore adds **80 + 30**, and every cleaner is checked independently; latest crew arrival controls feasibility. Optimizer semantics are preserved.

`RouteCalculation` is reused with provider, coordinates, timing, departure bucket/exact MOTIS request time, dataset version and quality. TTLs: LIVE 60 seconds, WALKING 30 minutes, FALLBACK_80 5 minutes. Failed dataset-health checks are coalesced and cached briefly. A repeated reserve calculation does not repeatedly invoke the engine.

## Map and updates

MapLibre GL JS **6.11.2**, [OpenFreeMap Liberty](https://openfreemap.org/quick_start/), no Google key. Attribution to OpenFreeMap, OpenMapTiles and OpenStreetMap is visible. [OpenFreeMap terms](https://openfreemap.org/tos/) describe an as-is service; map loading has an independent failure state and does not block business operations. The prebuild/predev script copies the matching MapLibre worker and sibling module for Next.js bundling.

Static feeds are checked daily; OSM refresh is at most once per seven days. Pipeline: download → bounded validation → candidate import/build → real geocode/reverse/walk health probes → atomic manifest activation. The active and previous prepared versions are retained; unsuccessful candidates cannot replace working data. Unchanged hashes reuse prepared data on deploy. RT is monitored every 30 seconds; the current endpoint is not ingested. `RT_LICENSE_CONFIRMED` must not be set until terms are actually confirmed; `RT_PREVIEW_ENABLED` does not permit LIVE.

Configuration defaults: `MAX_STATIC_AGE_DAYS=365`, `RT_MAX_AGE_SECONDS=120`, `RT_MIN_MATCH_RATIO=0.8`. Changing thresholds is not a substitute for establishing permission, compatibility or benchmark accuracy.

## Proof and benchmark limitations

Real private-engine PoC passed health, geocoding, reverse-geocoding, walking and three departure-time transit requests. Static BUS/WALK journeys were returned with `realTime=false`; these are research evidence only. Real RT ingestion could not be demonstrated because the source returned HTTP 500. Positive protobuf/compatibility/LIVE cases in automated tests are **synthetic fixtures**, not evidence that the real endpoint works.

`belgrade-pairs.json` contains 35 public directed point pairs across Novi Beograd, Zemun, Vračar, Dorćol, Voždovac, Banovo Brdo, Stari Grad and other districts. Three departure windows on 5 October 2026 (07:00, 13:00, 18:00 Belgrade time) produced **105 actual gateway measurements**: **48 WALKING, 57 FALLBACK_80, zero LIVE**. `benchmark-preview.json` is **BLOCKED**: no independent reference results, median absolute error and ±15-minute ratio are **unknown**, not zero. This is an infrastructure/quality observation run, not a completed accuracy comparison.

When RT becomes usable, replace the observation dates with current service-day windows and rerun; future-day static predictions do not become LIVE merely because today's RT feed is fresh. To complete admission, collect permitted independent manual references for the same coordinates, mode and departure times using `reference-template.json`, with source, minutes, evidence, collection date and permission confirmation. Do not scrape Google or substitute MOTIS's own static ETA as an independent reference. Run `node scripts/admin/routing-benchmark.mjs` with server credentials in the environment and `ROUTING_REFERENCE_FILE` pointing to the completed JSON. The gate requires all 90+ measurements / 30+ pairs eligible, healthy permissible LIVE data, median absolute error ≤10 minutes and at least 80% within ±15 minutes. FALLBACK_80 measurements cannot certify accuracy.

## Verification and release hold

65 targeted tests passed: gateway/benchmark 13, application/domain/readiness 51, real Railway + isolated Neon cache transaction 1. One pre-existing database suite was skipped in the unit-only invocation; the separate real transaction test passed and rolled back all fixtures. TypeScript and targeted ESLint passed. Address-coordinate migration and empty schema diff passed in app Preview; production migration was deliberately not applied.

Chrome smoke verified Settings Logistics, actual OpenFreeMap tiles, MOTIS address search, explicit candidate selection, pin dragging and confirmation without creating a cleaner. Calendar smoke returned no assigned jobs and no error. The final Preview diagnostics passed actual primary/fallback model calls, MOTIS address search and road routing; UI reported updated checks and global SHADOW. Production SHADOW and existing business records remain unchanged. Source-bound release evidence records engineering verification only, never routing accuracy or AUTO approval.

Remaining production/AUTO blockers: failed independent accuracy benchmark, unavailable/unlicensed RT with unknown compatibility, aged suburban static feed; after routing admission, owner must confirm existing cleaner coordinates, verify duration/crew coverage and complete the Preview live-booking proof. AUTO is never enabled by this work.
