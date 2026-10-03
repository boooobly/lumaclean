# Private MOTIS and protected gateway

Build context is this `infrastructure` directory. Engine Dockerfile: `motis/Dockerfile`; gateway Dockerfile: `routing-gateway/Dockerfile`. MOTIS is pinned to official version 2.11.3. Both images use Node 24 and the gateway's locked dependencies.

Railway configuration:

| Service | Variables | Network / storage |
| --- | --- | --- |
| motis | `PORT=8080`, `DATA_DIR=/data` | Private only; volume `/data`; health path `/health`, initial import timeout 3600 seconds |
| routing-gateway | `PORT=8080`, secret `ROUTING_TOKEN` (at least 32 characters), `MOTIS_URL=http://${{motis.RAILWAY_PRIVATE_DOMAIN}}:8080` | Public HTTPS gateway only; health path `/health`, timeout 120 seconds |

Default restart policy is on failure (three retries). Do not publish a MOTIS domain. Public `/health` reports gateway liveness; authenticated `/datasets/status` separately reports engine/data readiness. A gateway health check is not transit admission.

Deploy to the existing explicit Preview environment, from the application repository root:

```powershell
railway up infrastructure --path-as-root --project 11c95a43-6a82-4441-a4da-61257023df98 --environment e9ca34ea-b5cf-4a65-b8c0-250fd6354fbc --service 7783edc2-bf82-4bfa-a601-5d9ccf373d85 --detach --yes
railway up infrastructure --path-as-root --project 11c95a43-6a82-4441-a4da-61257023df98 --environment e9ca34ea-b5cf-4a65-b8c0-250fd6354fbc --service 4e55abeb-132f-4709-a2f9-dfa9bcbbaca3 --detach --yes
```

Set the same token in Vercel Preview's **server** variable `LUMACLEAN_ROUTING_TOKEN`, gateway URL in `LUMACLEAN_ROUTING_URL`, `LUMACLEAN_ROUTING_PROVIDER=MOTIS`, and `LUMACLEAN_GOOGLE_ROUTING_ENABLED=false`. Secrets must not be committed, passed in URL query parameters, logged, or placed in browser/public variables. Existing production variables remain unchanged until the accuracy/data gate passes.

RT ingestion is disabled by default. `RT_PREVIEW_ENABLED=true` permits ingestion for explicit research only; it does not grant use permission or qualify LIVE. `RT_LICENSE_CONFIRMED=true` is allowed only after actual permission is established. Current HTTP-500 RT source has neither flag enabled. Thresholds are `MAX_STATIC_AGE_DAYS=365`, `RT_MAX_AGE_SECONDS=120`, `RT_MIN_MATCH_RATIO=0.8`.

Daily GTFS checks and seven-day OSM refresh run inside the private service. Prepared datasets survive deploys. Failed downloads, validation, candidate imports or health probes preserve the active dataset; do not clear the volume to force an update. Dataset status exposes last update error and active hashes. The native engine's request output is suppressed to avoid coordinates in logs.

Targeted gateway tests:

```powershell
node --test infrastructure/routing-gateway/test/*.test.mjs
```

Private research probe (`poc.mjs`) uses only public Belgrade points, reports static transit separately and never certifies LIVE or production accuracy. See [routing evidence and admission procedure](../docs/routing/README.md).
