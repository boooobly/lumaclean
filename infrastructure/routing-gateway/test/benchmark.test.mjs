import test from "node:test";
import assert from "node:assert/strict";
import { evaluateBenchmark } from "../../../scripts/admin/routing-benchmark.mjs";
const safe = {
  routingReadiness: "LIVE",
  engine: { healthy: true },
  static: { valid: true },
  realtime: { usable: true, licenseConfirmed: true },
};
const rows = Array.from({ length: 105 }, (_, i) => ({
  pair: "p" + (i % 35),
  quality: "LIVE",
  durationSeconds: 1200,
  reference: {
    permissionConfirmed: true,
    source: "manual Google Maps",
    evidence: "recorded manual comparison",
    minutes: 25,
  },
}));
test("accuracy gate requires independent coverage and qualified data", () => {
  assert.equal(evaluateBenchmark(rows, safe).status, "PASSED");
  assert.equal(
    evaluateBenchmark(rows, {
      ...safe,
      realtime: { usable: false, licenseConfirmed: false },
    }).status,
    "BLOCKED",
  );
  assert.equal(
    evaluateBenchmark(
      rows.map((r) => ({ ...r, quality: "FALLBACK_80" })),
      safe,
    ).status,
    "BLOCKED",
  );
});
test("missing references leave accuracy unknown, never zero error", () => {
  const report = evaluateBenchmark(
    rows.map((r) => ({ ...r, reference: null })),
    safe,
  );
  assert.equal(report.independentReferences, 0);
  assert.equal(report.medianAbsoluteErrorMinutes, null);
  assert.equal(report.within15Ratio, null);
  assert.equal(report.status, "BLOCKED");
});
test("median and 80 percent bounds reject inaccurate routes", () => {
  assert.equal(
    evaluateBenchmark(
      rows.map((r) => ({ ...r, reference: { ...r.reference, minutes: 45 } })),
      safe,
    ).status,
    "BLOCKED",
  );
  assert.equal(evaluateBenchmark(rows.slice(0, 30), safe).status, "BLOCKED");
});
