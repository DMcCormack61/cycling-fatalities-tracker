import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const catalog = JSON.parse(readFileSync(new URL("../public/traffic-corridors.json", import.meta.url)));

test("Lancaster County traffic is PennDOT and denser than the HPMS sample", () => {
  const features = catalog.features.filter((row) => row.place === "Lancaster County");
  const local = features.filter((row) => row.service === "PennDOT local roads");
  const rms = features.filter((row) => row.service === "PennDOT RMS");
  assert.ok(features.length > 4000, `expected thousands of county sections, got ${features.length}`);
  assert.ok(local.length > 1500, `expected municipal streets, got ${local.length}`);
  assert.ok(rms.length > 2500, `expected state routes, got ${rms.length}`);
  assert.match(catalog.sourceName, /PennDOT/);
  assert.match(catalog.note, /Lancaster County/);
  assert.match(catalog.sourceUrl, /gis\.penndot\.gov/);

  const withShoulder = rms.find(
    (row) => Number.isFinite(row.speedMph) && row.speedMph > 0 && Number.isFinite(row.shoulderFt),
  );
  assert.ok(withShoulder, "an RMS section should publish speed and shoulder width");
  assert.equal(typeof withShoulder.name, "string");
  assert.ok(withShoulder.name.length > 0);
  assert.ok(withShoulder.aadt > 0);

  const quiet = local.find((row) => row.speedMph == null && row.shoulderFt == null && row.aadt > 0);
  assert.ok(quiet, "a local road may omit speed and shoulder");
  assert.match(quiet.name, /,/);

  for (const row of features) {
    assert.ok(row.coordinates.length >= 2);
    for (const [lng, lat] of row.coordinates) {
      assert.ok(lng < -75.8 && lng > -76.8);
      assert.ok(lat > 39.7 && lat < 40.4);
    }
  }

  const chicago = catalog.features.filter((row) => row.place === "Chicago");
  assert.equal(chicago.length, 108);
});
