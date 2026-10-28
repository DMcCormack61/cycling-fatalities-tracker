import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  haversineKm,
  parseCuratedSeed,
  placeOverlap,
  suppressCuratedOverlaps,
  suppressNewsOverlaps,
  suppressPenndotDeathsCoveredByFars,
} from "./crash-dedupe.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("curated seed parser finds the named filings", () => {
  const rows = parseCuratedSeed(readFileSync(join(root, "src/lib/crashes-seed.ts"), "utf8"));
  assert.ok(rows.length >= 12);
  assert.ok(rows.some((row) => row.id === "frost-fort-worth-2024-05-11" && row.stateCode === "TX"));
  assert.ok(rows.some((row) => row.victimName === "Robert Hecker Jr."));
});

test("curated filing suppresses the same-day FARS row and keeps a different city", () => {
  const anchors = [
    {
      id: "frost-fort-worth-2024-05-11",
      occurredOn: "2024-05-11",
      stateCode: "TX",
      city: "Fort Worth",
      latitude: 32.76525,
      longitude: -97.28766,
      datePrecision: "day",
    },
  ];
  const rows = [
    {
      id: "fars-near",
      ingestSource: "fars",
      occurredOn: "2024-05-11",
      datePrecision: "day",
      stateCode: "TX",
      city: "Tarrant County",
      latitude: 32.77,
      longitude: -97.29,
    },
    {
      id: "fars-far",
      ingestSource: "fars",
      occurredOn: "2024-05-11",
      datePrecision: "day",
      stateCode: "TX",
      city: "Harris County",
      latitude: 29.76,
      longitude: -95.37,
    },
  ];
  const result = suppressCuratedOverlaps(rows, anchors);
  assert.equal(result.suppressed, 1);
  assert.deepEqual(
    result.rows.map((row) => row.id),
    ["fars-far"],
  );
});

test("PennDOT month row matches a curated crash only when it is close", () => {
  const anchors = [
    {
      occurredOn: "2025-01-05",
      stateCode: "PA",
      city: "Philadelphia",
      latitude: 39.9526,
      longitude: -75.1652,
      datePrecision: "day",
    },
  ];
  const rows = [
    {
      id: "near",
      ingestSource: "penndot",
      occurredOn: "2025-01-01",
      datePrecision: "month",
      stateCode: "PA",
      city: "Philadelphia",
      latitude: 39.95,
      longitude: -75.16,
    },
    {
      id: "york",
      ingestSource: "penndot",
      occurredOn: "2025-01-01",
      datePrecision: "month",
      stateCode: "PA",
      city: "York County",
      latitude: 39.96,
      longitude: -76.72,
    },
  ];
  const result = suppressCuratedOverlaps(rows, anchors);
  assert.deepEqual(
    result.rows.map((row) => row.id),
    ["york"],
  );
});

test("one FARS case suppresses one nearby PennDOT death", () => {
  const fars = [
    {
      stateCode: "PA",
      fatalities: 1,
      policeReportId: "100",
      occurredOn: "2024-06-02",
      latitude: 40.04,
      longitude: -76.3,
      city: "Lancaster County",
    },
    {
      stateCode: "PA",
      fatalities: 1,
      policeReportId: "100",
      occurredOn: "2024-06-02",
      latitude: 40.04,
      longitude: -76.3,
      city: "Lancaster County",
    },
  ];
  const penndot = [
    {
      id: "same",
      fatalities: 1,
      occurredOn: "2024-06-01",
      latitude: 40.041,
      longitude: -76.301,
    },
    {
      id: "other",
      fatalities: 1,
      occurredOn: "2024-06-01",
      latitude: 40.2,
      longitude: -76.9,
    },
    {
      id: "injury",
      fatalities: 0,
      occurredOn: "2024-06-01",
      latitude: 40.041,
      longitude: -76.301,
    },
  ];
  const result = suppressPenndotDeathsCoveredByFars(penndot, fars);
  assert.equal(result.suppressed, 1);
  assert.deepEqual(
    result.rows.map((row) => row.id),
    ["other", "injury"],
  );
});

test("news on a publication date is kept unless the victim name matches", () => {
  const official = [
    {
      stateCode: "TX",
      city: "Fort Worth",
      victimName: "Daniel Frost",
      occurredOn: "2024-05-11",
      datePrecision: "day",
      latitude: 32.7,
      longitude: -97.3,
    },
  ];
  const news = [
    {
      id: "pub",
      stateCode: "TX",
      city: "Fort Worth",
      victimName: null,
      occurredOn: "2024-05-12",
      datePrecision: "published",
      latitude: null,
      longitude: null,
    },
    {
      id: "named",
      stateCode: "TX",
      city: "Dallas",
      victimName: "Daniel Frost",
      occurredOn: "2024-05-20",
      datePrecision: "published",
    },
  ];
  const result = suppressNewsOverlaps(news, official);
  assert.deepEqual(
    result.rows.map((row) => row.id),
    ["pub"],
  );
});

test("distance helper rejects missing coordinates", () => {
  assert.equal(haversineKm(null, -97, 32, -97), Infinity);
  assert.equal(placeOverlap("Fort Worth", "Tarrant County"), false);
  assert.equal(placeOverlap("Lancaster County", "Lancaster"), true);
});
