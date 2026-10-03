# LumaClean routing Preview — 3 October 2026

The implementation is on `codex/admin-motis-routing`, in the existing [draft PR #1](https://github.com/boooobly/lumaclean/pull/1). Preview and production use hybrid MOTIS routing and MapLibre/OpenFreeMap. Production additive migrations and authenticated gateway smoke passed. Website AI remains **SHADOW**; AUTO was not activated. Routing readiness is **DEGRADED** with the owner-approved 80-minute reserve. BusMaps approval, Google, BusLogic RT and a static-transit accuracy benchmark are not prerequisites for this conservative routing mode.

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
- Vercel [application Preview](https://lumaclean-3lsqn8l02-vladislavs-projects-0eae0ea3.vercel.app/admin/settings): provider `MOTIS`, Google adapter disabled. Protected Preview access remains enabled. This immutable release-verification Preview uses the production gateway while retaining the Preview database; all synthetic Orders remain in Preview.

Production is a separate Railway environment (`47a24caf-9468-457c-804d-f62a8a630cb9`) with `motis-production` (`13274da0-6718-4461-bc65-37f56a34dcc9`) and `routing-gateway-production` (`bcc92db6-bc77-4dac-9aba-357788a8ce26`). The engine has its own 5,000 MB `/data` volume and no public domain. Only the authenticated [production gateway](https://routing-gateway-production-production.up.railway.app/health) is exposed. Server credentials are separate from Preview. The [production application](https://lumacleanrs.com/admin/settings) was built with production variables and the production database, not by promoting a Preview artifact.

Only gateway allowlisted operations are exposed: health, datasets status, geocode, reverse-geocode, route, route-details and matrix. Bounds: Belgrade region, 100 matrix cells, 16 KB request body, 1 MB upstream response, timeouts, rate and concurrency limits, bounded in-memory caches. Requests and precise coordinates are not logged. URL and token are server-side `LUMACLEAN_ROUTING_URL` / `LUMACLEAN_ROUTING_TOKEN`; never `NEXT_PUBLIC` and never included in this report.

`RoutingProvider` remains the domain boundary. CRM, Calendar, AI tools, AvailabilityService and the existing ScheduleOptimizer use it; no LumaClean optimizer runs in the gateway. Google can only be selected with both explicit provider selection and explicit enablement.

## Quality, coordinates and cache

- `LIVE`: healthy engine, current validated static data, confirmed RT permission, RT age at most 120 seconds, default minimum trip/route/stop match 80%, usable TripUpdates, and a matching actual realtime leg, source and service date. Cancelled/looped-calendar/static-only journeys do not qualify. The requested date must fall within dataset validity.
- `WALKING`: verified walking journey, independent of RT. For transit requests, a walk up to 80 minutes can be used; longer walks use the owner-approved reserve instead. Explicit walking requests have a bounded 120-minute maximum and become unresolved when unavailable.
- `FALLBACK_80`: exactly 4,800 seconds for unverified transport or provider failure. It is the owner's reserve, not an observed transit or driving ETA. Static research ETA is never labelled LIVE.
- `LIVE_EXTERNAL`: an active BusMaps account, available quota and a usable route with coherent chronology, actual realtime departure/arrival and fresh updates on every transit leg. Static or partially realtime responses do not qualify. `PENDING_APPROVAL` makes zero HTTP attempts, consumes no quota and is not a provider error.
- `STATIC_CANDIDATE`: MOTIS static duration can inform ranking and admin research. Hard feasibility always uses the approved reserve when external verification is absent, whether the static estimate is 34 or 200 minutes. Optimizer matrices do not consume BusMaps quota; only selected critical legs are verified.
- `UNRESOLVED`: missing, unconfirmed or out-of-region coordinates block automatic booking. Free-text address is not a routing input.

MOTIS autocomplete requires explicit candidate selection. MapLibre shows a draggable pin; numeric coordinate fields also work if map tiles fail. A separate user checkbox and confirmation creates a server-signed proof; saving the CRM/cleaner form stores coordinates and the confirmation flag. Editing address/pin invalidates confirmation. Existing records remain unconfirmed until reviewed; the migration does not silently approve old coordinates.

Travel and business buffer are separate: home to the first job adds **no 30-minute buffer**; subsequent jobs require previous end + travel + 30 minutes. Fallback therefore adds **80 + 30**, and every cleaner is checked independently; latest crew arrival controls feasibility. Optimizer semantics are preserved.

`RouteCalculation` is reused with provider, coordinates, exact MOTIS request time, dataset version, quality and optional-provider configuration. Verified BusMaps leg caches are short; monthly quota is atomically reserved before HTTP and is not refunded by a booking rollback. Pending access bypasses HTTP, errors, quota and leases. Selected-slot validation forces fresh critical-leg checks, then reruns feasibility for the exact start and crew. Failed dataset-health checks are coalesced and cached briefly.

## Map and updates

MapLibre GL JS **6.11.2**, [OpenFreeMap Liberty](https://openfreemap.org/quick_start/), no Google key. Attribution to OpenFreeMap, OpenMapTiles and OpenStreetMap is visible. [OpenFreeMap terms](https://openfreemap.org/tos/) describe an as-is service; map loading has an independent failure state and does not block business operations. The prebuild/predev script copies the matching MapLibre worker and sibling module for Next.js bundling.

Static feeds are checked daily; OSM refresh is at most once per seven days. Pipeline: download → bounded validation → candidate import/build → real geocode/reverse/walk health probes → atomic manifest activation. The active and previous prepared versions are retained; unsuccessful candidates cannot replace working data. Unchanged hashes reuse prepared data on deploy. RT is monitored every 30 seconds; the current endpoint is not ingested. `RT_LICENSE_CONFIRMED` must not be set until terms are actually confirmed; `RT_PREVIEW_ENABLED` does not permit LIVE.

Configuration defaults: `MAX_STATIC_AGE_DAYS=365`, `RT_MAX_AGE_SECONDS=120`, `RT_MIN_MATCH_RATIO=0.8`. Changing thresholds is not a substitute for establishing permission, compatibility or benchmark accuracy.

## Proof and benchmark limitations

Real private-engine PoC passed health, geocoding, reverse-geocoding, walking and three departure-time transit requests. Static BUS/WALK journeys were returned with `realTime=false`; these are research evidence only. Real RT ingestion could not be demonstrated because the source returned HTTP 500. Positive protobuf/compatibility/LIVE cases in automated tests are **synthetic fixtures**, not evidence that the real endpoint works.

`belgrade-pairs.json` contains 35 public directed point pairs across Novi Beograd, Zemun, Vračar, Dorćol, Voždovac, Banovo Brdo, Stari Grad and other districts. Three departure windows on 5 October 2026 (07:00, 13:00, 18:00 Belgrade time) produced **105 actual gateway measurements**: **48 WALKING, 57 FALLBACK_80, zero LIVE**. `benchmark-preview.json` is **BLOCKED**: no independent reference results, median absolute error and ±15-minute ratio are **unknown**, not zero. This is an infrastructure/quality observation run, not a completed accuracy comparison.

This historical benchmark evaluates transit accuracy; it does not block production with WALKING / FALLBACK_80. Its missing references and unavailable RT remain explicit limitations. Future-day static predictions do not become realtime merely because today's feed is fresh. Independent references must be permitted and match coordinates, mode and departure time; never scrape Google or use MOTIS's own static ETA as the reference.

After BusMaps application `BM-API-2026-000110` becomes active, set `BUSMAPS_STATUS=ACTIVE`, add its server-only API key to Preview and run diagnostics plus 10–15 representative Belgrade comparisons against MOTIS and permitted manual Google spot checks. No architecture change is required. The current account is pending; the key stays outside Git and is absent from deployment variables. Timeout, quota, errors, scheduled-only and missing realtime verification retain the 80-minute reserve.

## Current verification

59 targeted tests passed: BusMaps 15, MOTIS/scheduling 14, live readiness 8 and native provider/policy contracts 22. One isolated database suite was intentionally skipped in that unit invocation. Real Preview booking and rollback-based scheduling checks were performed separately. TypeScript, targeted ESLint and Vercel builds passed. Both additive migrations and an empty schema diff passed in Preview and production. Previous stage's 65-test evidence remains historical rather than being counted as rerun.

Chrome confirmed both existing real cleaners through MOTIS autocomplete, MapLibre pin and explicit confirmation. Their user-requested neighboring address was selected from an exact house-number result; no coordinates were guessed and no cleaners were fabricated. The confirmed location was promoted with an audit event. Regular remains owner-confirmed: 150 minutes, two cleaners, 1–100 square metres, cleaning reserve zero. Deep 480 minutes for two cleaners around 50 square metres remains inactive pending owner confirmation; no reserve was chosen on the owner's behalf.

The first complete Preview UI test passed native PoYo qualification, real price/duration engines, MOTIS geocoding, real Railway routing, slot tokens, revalidation, explicit confirmation and Order creation. Its synthetic client, conversation and Order were safely cleaned. The final release-verification Preview repeated the full booking through the production gateway and Preview database: PoYo timed out after 22 seconds, OpenRouter returned a native `calculatePrice` call and all eight steps passed. Twelve persisted route observations were FALLBACK_80 / 4,800 seconds. Cleanup left zero synthetic clients, conversations and Orders. Primary success and actual failover are separate observations, not simulated success.

The Preview test reuses the application's existing provider-failover helper and displays sanitized attempt provenance. A successful fallback diagnostic permits this technical Preview test despite a failed primary diagnostic; credentials, fallback, coordinates, routing and confirmed Regular duration remain required. The AUTO admission checks are unchanged. PoYo's intermittent timeouts remain an operational limitation rather than being hidden by the test.

Independent real Preview scheduling checks, repeated against the production gateway with the Preview database, passed: previous end 12:00 + reserve 80 + buffer 30 gives 13:50; 13:30 rejected and 14:00 feasible. Two real crew members arriving 13:40 and 14:10 reject 14:00 and accept 14:10. First-trip extra buffer is zero. All fixture transactions rolled back. Production smoke passed healthy MOTIS 2.11.3, WALKING, FALLBACK_80, anonymous 401, actual map tiles and primary/fallback/address/routing diagnostics. No production synthetic Orders were created.

Production UI accepted the signed, cleaned final Preview proof after checking its signature, expiry and exact configuration. Readiness reports 4/5 required systems ready: Deep duration coverage remains the concrete blocker for the current service scope. The owner must confirm Deep and its cleaning reserve, then explicitly decide whether to enable limited AUTO. SHADOW quality review remains advisable; it is displayed as a warning. Optional provider approval and transit-accuracy research are not blockers for conservative routing. AUTO is never enabled by this work.

The release-verification Preview above is immutable and intentionally uses the production gateway with the Preview database so its configuration-bound report is transferable. Ordinary Vercel Preview variables were restored to the separate Preview gateway afterwards. New Preview builds must rerun their own proof; a report from different routing configuration is correctly rejected. Sanitized outcomes are recorded in `hybrid-live-verification.json`; no coordinates, contacts, API keys or proof signatures are published.
