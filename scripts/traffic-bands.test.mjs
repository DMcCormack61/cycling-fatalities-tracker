import assert from "node:assert/strict";
import test from "node:test";
import { classifySegments, trafficBand, upperFifthCutoff } from "../src/lib/traffic-bands.mjs";

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

test("empty input has no cutoff", () => {
  const result = classifySegments([]);
  assert.equal(result.volumeCutoff, null);
  assert.equal(result.segments.length, 0);
});
