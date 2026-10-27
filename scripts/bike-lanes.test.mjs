import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const catalog = JSON.parse(readFileSync(new URL("../public/bike-lanes.json", import.meta.url), "utf8"));

function near(lng, lat, span = 0.08) {
  return catalog.features.some((lane) =>
    lane.coordinates.some(
      ([x, y]) => Math.abs(x - lng) <= span && Math.abs(y - lat) <= span,
    ),
  );
}

test("bundled bike lanes are dedicated OpenStreetMap ways", () => {
  assert.equal(catalog.sourceName, "OpenStreetMap dedicated bicycle ways");
  assert.match(catalog.note, /Shared-lane markings are excluded/);
  assert.ok(catalog.features.length >= 20, `expected lanes, got ${catalog.features.length}`);
  for (const lane of catalog.features) {
    assert.match(lane.id, /^osm-\d+$/);
    assert.ok(lane.coordinates.length >= 2);
    for (const pair of lane.coordinates) {
      assert.equal(pair.length, 2);
      assert.ok(pair[0] < -65 && pair[0] > -125);
      assert.ok(pair[1] > 24 && pair[1] < 50);
    }
  }
});

test("lanes cover the desk cities and Lancaster County", () => {
  assert.ok(near(-87.63244, 41.88479), "Chicago");
  assert.ok(near(-87.71585, 41.88154), "Chicago Garfield Park");
  assert.ok(near(-75.18, 39.97), "Philadelphia");
  assert.ok(near(-76.39674, 40.10196), "East Hempfield");
  assert.ok(near(-71.10777, 42.35325), "Cambridge");
});
