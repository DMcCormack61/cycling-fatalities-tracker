import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { googleMapsSearchUrl } from "../src/lib/google-maps-url.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("uses filed coordinates and ignores the text place", () => {
  const url = googleMapsSearchUrl({
    latitude: 32.76525,
    longitude: -97.28766,
    locationName: "E 1st St & Beach St, near Gateway Park",
    city: "Fort Worth",
    state: "Texas",
  });
  assert.equal(url, "https://www.google.com/maps/search/?api=1&query=32.76525,-97.28766");
});

test("falls back to an encoded street, city, and state query", () => {
  const url = googleMapsSearchUrl({
    latitude: null,
    longitude: null,
    locationName: "E 1st St & Beach St",
    city: "Fort Worth",
    state: "Texas",
  });
  assert.equal(
    url,
    "https://www.google.com/maps/search/?api=1&query=" +
      encodeURIComponent("E 1st St & Beach St, Fort Worth, Texas"),
  );
});

test("rejects an unfiled pin and hides the link when no place remains", () => {
  assert.equal(
    googleMapsSearchUrl({
      latitude: 0,
      longitude: 0,
      locationName: "Philadelphia, Pennsylvania",
      city: "Philadelphia",
      state: "Pennsylvania",
    }),
    "https://www.google.com/maps/search/?api=1&query=" +
      encodeURIComponent("Philadelphia, Pennsylvania"),
  );
  assert.equal(
    googleMapsSearchUrl({
      latitude: "40.10196",
      longitude: "-76.39674",
      locationName: "665 Long Rd",
      city: "Lancaster County",
      state: "Pennsylvania",
    }),
    "https://www.google.com/maps/search/?api=1&query=40.10196,-76.39674",
  );
  assert.equal(
    googleMapsSearchUrl({
      latitude: 91,
      longitude: -76,
      locationName: "Moraine State Park, Pennsylvania",
      city: "Butler County",
      state: "Pennsylvania",
    }),
    "https://www.google.com/maps/search/?api=1&query=" +
      encodeURIComponent("Moraine State Park, Butler County, Pennsylvania"),
  );
  assert.equal(
    googleMapsSearchUrl({
      latitude: null,
      longitude: null,
      locationName: "  ",
      city: "",
      state: null,
    }),
    null,
  );
});

test("crash detail does not import scripts at runtime", () => {
  const files = [
    "src/routes/crashes.$id.tsx",
    "src/components/crash-locale-map.tsx",
    "src/lib/google-maps-url.mjs",
  ];
  for (const file of files) {
    const source = readFileSync(join(root, file), "utf8");
    assert.equal(/from\s+["'][^"']*scripts\//.test(source), false, file);
  }
});
