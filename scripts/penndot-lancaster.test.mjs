import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PENNDOT_COUNTIES } from "../src/lib/penndot-region.mjs";

const catalog = JSON.parse(readFileSync(new URL("../public/traffic-corridors.json", import.meta.url)));

test("Lancaster County traffic is PennDOT and denser than the HPMS sample", () => {
  const features = catalog.features.filter((row) => row.place === "Lancaster County");
  const local = features.filter((row) => row.service === "PennDOT local roads");
  const rms = features.filter((row) => row.service === "PennDOT RMS");
  assert.ok(features.length > 2000, `expected thousands of county sections, got ${features.length}`);
  assert.ok(local.length > 500, `expected municipal streets, got ${local.length}`);
  assert.ok(rms.length > 1500, `expected state routes, got ${rms.length}`);
  assert.match(catalog.sourceName, /PennDOT/);
  assert.match(catalog.note, /Lancaster County/);
  assert.match(catalog.sourceUrl, /gis\.penndot\.gov/);

  const limited = rms.filter((row) => row.accessControl === "1");
  assert.ok(limited.length > 100, "PennDOT ACCESS_CTRL 1 marks limited-access state routes");
  const regionLimited = catalog.features.filter(
    (row) => row.service === "PennDOT RMS" && row.accessControl === "1",
  );
  assert.ok(
    regionLimited.some((row) => row.shoulderFt > 4 && row.speedMph < 45),
    "some limited-access segments would have hit the wide-shoulder cap",
  );
  assert.match(catalog.note, /ACCESS_CTRL 1/);

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

  const ids = new Set(features.map((row) => row.id));
  assert.equal(ids.size, features.length);

  const chicago = catalog.features.filter((row) => row.place === "Chicago");
  assert.equal(chicago.length, 108);

  for (const county of PENNDOT_COUNTIES) {
    const rows = catalog.features.filter((row) => row.place === county.name);
    const countyLocal = rows.filter((row) => row.service === "PennDOT local roads");
    const countyRms = rows.filter((row) => row.service === "PennDOT RMS");
    assert.ok(rows.length > 400, `${county.name} should have PennDOT sections, got ${rows.length}`);
    assert.ok(countyLocal.length > 50, `${county.name} should include local roads`);
    assert.ok(countyRms.length > 100, `${county.name} should include state routes`);
    assert.match(catalog.note, new RegExp(county.name.replace(" County", "")));
  }

  const regionIds = catalog.features.filter((row) =>
    PENNDOT_COUNTIES.some((county) => county.name === row.place),
  );
  assert.equal(new Set(regionIds.map((row) => row.id)).size, regionIds.length);
});
