import assert from "node:assert/strict";
import test from "node:test";
import { articleId, extractCandidate } from "./news-extract.mjs";

test("extracts a killed cyclist with a city and state", () => {
  const row = extractCandidate({
    title: "Cyclist killed in Austin, Texas - KXAN",
    url: "https://example.com/austin",
    publishedOn: "2024-05-12",
    sourceName: "KXAN",
  });
  assert.equal(row.city, "Austin");
  assert.equal(row.stateCode, "TX");
  assert.equal(row.outcome, "killed");
  assert.equal(row.fatalities, 1);
  assert.equal(row.victimName, null);
  assert.equal(row.verified, false);
  assert.equal(row.reviewStatus, "pending");
  assert.equal(row.datePrecision, "published");
  assert.equal(row.sourceName, "KXAN");
});

test("keeps an explicit name and crash date from the headline", () => {
  const row = extractCandidate({
    title: "Jane Doe, 34, was killed while riding in Madison, Wisconsin on May 11, 2024",
    url: "https://example.com/madison",
    publishedOn: "2024-05-12",
    sourceName: "Example",
  });
  assert.equal(row.victimName, "Jane Doe");
  assert.equal(row.occurredOn, "2024-05-11");
  assert.equal(row.datePrecision, "day");
  assert.equal(row.city, "Madison");
  assert.equal(row.state, "Wisconsin");
});

test("does not invent a place or an outcome", () => {
  assert.equal(
    extractCandidate({
      title: "Police said a cyclist was injured",
      url: "https://example.com/no-place",
      publishedOn: "2024-05-12",
      sourceName: "Example",
    }),
    null,
  );
  assert.equal(
    extractCandidate({
      title: "Bicyclist struck in Lancaster County, Pennsylvania",
      url: "https://example.com/struck",
      publishedOn: "2024-05-12",
      sourceName: "Example",
    }),
    null,
  );
});

test("reads an injury and a county, and does not treat a title word as a name", () => {
  const row = extractCandidate({
    title: "Cyclist injured on Main Street in Boise, Idaho",
    url: "https://example.com/boise",
    publishedOn: "2025-03-02",
    sourceName: "Example",
  });
  assert.equal(row.outcome, "serious_injury");
  assert.equal(row.injured, 1);
  assert.equal(row.fatalities, 0);
  assert.equal(row.city, "Boise");
  assert.equal(row.victimName, null);

  const county = extractCandidate({
    title: "Bicyclist killed in Lancaster County, Pa.",
    url: "https://example.com/lanc",
    publishedOn: "2025-10-08",
    sourceName: "WGAL",
  });
  assert.equal(county.city, "Lancaster County");
  assert.equal(county.stateCode, "PA");
  assert.equal(county.victimName, null);
});

test("West Virginia is not shortened to Virginia", () => {
  const row = extractCandidate({
    title: "Cyclist killed in Charleston, West Virginia",
    url: "https://example.com/wv",
    publishedOn: "2025-01-02",
    sourceName: "Example",
  });
  assert.equal(row.stateCode, "WV");
  assert.equal(row.city, "Charleston");
});

test("does not treat Police ID or a Washington street as a state", () => {
  assert.equal(
    extractCandidate({
      title: "Police ID New Haven bicyclist killed in hit-and-run",
      url: "https://example.com/id",
      publishedOn: "2026-08-17",
      sourceName: "Example",
    }),
    null,
  );
  assert.equal(
    extractCandidate({
      title:
        "Chicago woman arrested after girl on bicycle injured in hit-and-run at Route 31, W. Washington St.",
      url: "https://example.com/street",
      publishedOn: "2026-08-26",
      sourceName: "Example",
    }),
    null,
  );
});

test("does not take the news outlet's home state as the crash place", () => {
  assert.equal(
    extractCandidate({
      title:
        "Bend family doctor critically injured after SUV allegedly runs red light - Central Oregon Daily News",
      url: "https://example.com/bend",
      publishedOn: "2026-06-01",
      sourceName: "Central Oregon Daily News",
    }),
    null,
  );
  assert.equal(
    extractCandidate({
      title: "Teen Cyclist Killed in Collision With Minivan in Burlington - Seven Days, VT",
      url: "https://example.com/burlington",
      publishedOn: "2026-06-02",
      sourceName: "Seven Days",
    }),
    null,
  );
});

test("reads a city dateline from a government outlet", () => {
  const row = extractCandidate({
    title: "UPDATE: Cyclist Killed in Crash Identified - City of Portland, Oregon (.gov)",
    url: "https://example.com/portland",
    publishedOn: "2026-04-02",
    sourceName: "City of Portland",
  });
  assert.equal(row.city, "Portland");
  assert.equal(row.stateCode, "OR");
  assert.equal(row.outcome, "killed");
});

test("keeps a name the headline says was identified", () => {
  const row = extractCandidate({
    title: "Bicyclist killed in Grayslake, IL ID'd as Virginia Girmscheid",
    url: "https://example.com/grayslake",
    publishedOn: "2026-03-01",
    sourceName: "Example",
  });
  assert.equal(row.victimName, "Virginia Girmscheid");
  assert.equal(row.city, "Grayslake");
  assert.equal(row.stateCode, "IL");
});

test("article ids are stable", () => {
  assert.equal(articleId("https://example.com/a"), articleId("https://example.com/a"));
  assert.notEqual(articleId("https://example.com/a"), articleId("https://example.com/b"));
});
