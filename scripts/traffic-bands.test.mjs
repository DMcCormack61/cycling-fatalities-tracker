import assert from "node:assert/strict";
import test from "node:test";
import {
  classifySegments,
  lancasterBand,
  trafficBand,
  upperFifthCutoff,
} from "../src/lib/traffic-bands.mjs";

test("80th percentile of 1..10 sits between 8 and 9", () => {
  const cutoff = upperFifthCutoff([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.ok(Math.abs(cutoff - 8.2) < 1e-9);
});

test("red is both upper-20%, orange is exactly one, green is both below", () => {
  const rows = [];
  for (let i = 1; i <= 8; i += 1) {
    rows.push({ id: `v${i}`, aadt: i * 1000, speedMph: 25 });
  }
  // Eight sections at 25 mph sit below the 80th percentile; two at 70 mph are high.
  rows.push({ id: "fast-quiet", aadt: 1000, speedMph: 70 });
  rows.push({ id: "fast-busy", aadt: 10000, speedMph: 70 });
  const { volumeCutoff, speedCutoff, segments } = classifySegments(rows);
  const byId = Object.fromEntries(segments.map((s) => [s.id, s.band]));
  assert.ok(volumeCutoff != null && speedCutoff != null);
  assert.ok(volumeCutoff > 7000 && volumeCutoff < 8000);
  assert.ok(speedCutoff > 25 && speedCutoff < 70);
  assert.equal(byId["fast-busy"], "red");
  assert.equal(byId["fast-quiet"], "orange");
  assert.equal(byId.v8, "orange");
  assert.equal(byId.v1, "green");
  assert.equal(trafficBand(1, 1, 10, 10), "green");
  assert.equal(trafficBand(10, 1, 10, 10), "orange");
  assert.equal(trafficBand(1, 10, 10, 10), "orange");
  assert.equal(trafficBand(10, 10, 10, 10), "red");
});

test("a missing posted speed is not treated as a high speed", () => {
  const rows = [];
  for (let i = 0; i < 7; i += 1) rows.push({ id: `slow-${i}`, aadt: 1000, speedMph: 25 });
  rows.push({ id: "fast-quiet", aadt: 1000, speedMph: 70 });
  rows.push({ id: "busy-unknown", aadt: 20000, speedMph: null });
  rows.push({ id: "busy-fast", aadt: 20000, speedMph: 70 });
  const { segments } = classifySegments(rows);
  const byId = Object.fromEntries(segments.map((s) => [s.id, s.band]));
  assert.equal(byId["busy-unknown"], "orange");
  assert.equal(byId["busy-fast"], "red");
  assert.equal(byId["fast-quiet"], "orange");
  assert.equal(byId["slow-0"], "green");
});

test("Lancaster PennDOT: red wins, then amber, then volume under 400 is green", () => {
  // Cutoffs sit high, so the relative rule alone would leave these green.
  assert.equal(lancasterBand(399, 25, 8, 10000, 60), "green");
  assert.equal(lancasterBand(399, 25, null, 10000, 60), "green");
  assert.equal(lancasterBand(399, 40, 2, 10000, 60), "green");
  assert.equal(lancasterBand(1000, 25, 8, 10000, 60), "green");
  assert.equal(lancasterBand(200, null, null, 10000, 60), "green");

  assert.equal(lancasterBand(100, 25, 0, 10000, 60), "orange");
  assert.equal(lancasterBand(100, 25, 1.9, 10000, 60), "orange");
  assert.equal(lancasterBand(200, 41, 8, 10000, 60), "orange");
  assert.equal(lancasterBand(1001, 25, 8, 10000, 60), "orange");
  assert.equal(lancasterBand(1500, null, null, 10000, 60), "orange");
  assert.equal(lancasterBand(200, null, 0, 10000, 60), "orange");

  // Volume under 400 still yields to an amber trigger, and to red.
  assert.equal(lancasterBand(300, 45, 8, 10000, 30), "orange");
  assert.equal(lancasterBand(300, 35, 8, 10000, 30), "green");
  assert.equal(lancasterBand(350, 70, 0, 200, 40), "red");

  // A shoulder wider than 4 ft and a posted speed under 45 mph cannot be red.
  assert.equal(lancasterBand(5000, 40, 4.1, 1000, 30), "orange");
  assert.equal(lancasterBand(5000, 44, 6, 1000, 30), "orange");
  assert.equal(lancasterBand(5000, 40, 4, 1000, 30), "red");
  assert.equal(lancasterBand(5000, 45, 6, 1000, 30), "red");
  assert.equal(lancasterBand(5000, 40, null, 1000, 30), "red");
  assert.equal(lancasterBand(200, 30, 6, 10000, 60), "green");
  assert.equal(lancasterBand(200, 35, 6, 100, 30), "green");

  // At or above 400, with no amber trigger, the upper-20% rule still colors one-high amber.
  assert.equal(lancasterBand(500, 25, 8, 400, 30), "orange");
  assert.equal(lancasterBand(500, 25, 8, 10000, 60), "green");

  const rows = [];
  for (let i = 0; i < 7; i += 1) {
    rows.push({ id: `quiet-${i}`, aadt: 50, speedMph: 25, shoulderFt: 8, service: "PennDOT local roads" });
  }
  rows.push({ id: "fast", aadt: 50, speedMph: 55, shoulderFt: 8, service: "PennDOT RMS" });
  rows.push({ id: "busy-slow", aadt: 350, speedMph: 25, shoulderFt: 8, service: "PennDOT RMS" });
  rows.push({ id: "both", aadt: 350, speedMph: 55, shoulderFt: 0, service: "PennDOT RMS" });
  const { segments } = classifySegments(rows);
  const byId = Object.fromEntries(segments.map((s) => [s.id, s.band]));
  assert.equal(byId.both, "red");
  assert.equal(byId["quiet-0"], "green");
  assert.equal(byId.fast, "orange");
  assert.equal(byId["busy-slow"], "green");

  const hpms = classifySegments([
    { id: "hpms-narrow", aadt: 100, speedMph: 25, shoulderFt: 0, service: "HPMS_FULL_PA_2023" },
    ...Array.from({ length: 7 }, (_, i) => ({
      id: `fill-${i}`,
      aadt: 100,
      speedMph: 25,
      service: "HPMS_FULL_PA_2023",
    })),
    { id: "high-a", aadt: 5000, speedMph: 70, service: "HPMS_FULL_PA_2023" },
    { id: "high-b", aadt: 5000, speedMph: 70, service: "HPMS_FULL_PA_2023" },
  ]);
  const hpmsById = Object.fromEntries(hpms.segments.map((s) => [s.id, s.band]));
  assert.equal(hpmsById["hpms-narrow"], "green");
});

test("empty input has no cutoff", () => {
  const result = classifySegments([]);
  assert.equal(result.volumeCutoff, null);
  assert.equal(result.segments.length, 0);
});
