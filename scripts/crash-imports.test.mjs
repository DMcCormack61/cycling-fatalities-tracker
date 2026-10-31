import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { prepareImports } from "./load-crash-imports.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("bundled FARS and PennDOT files are far larger than the curated seed", () => {
  const fars = JSON.parse(readFileSync(join(root, "data/crash-imports/fars.json"), "utf8"));
  const penndot = JSON.parse(readFileSync(join(root, "data/crash-imports/penndot.json"), "utf8"));
  const news = JSON.parse(readFileSync(join(root, "data/crash-imports/news.json"), "utf8"));
  assert.ok(fars.length > 3000);
  assert.equal(fars.filter((row) => row.occurredOn.startsWith("2024")).length, 1103);
  assert.ok(fars.every((row) => row.victimName == null && row.verified === true && row.ingestSource === "fars"));
  assert.equal(fars.filter((row) => /^\d/.test(row.city) || row.city === "District of Columbia County").length, 0);
  assert.ok(penndot.length > 4000);
  assert.ok(penndot.filter((row) => row.context.includes("Lancaster traffic region")).length > 800);
  assert.ok(penndot.every((row) => row.victimName == null && row.stateCode === "PA"));
  assert.ok(news.length > 0);
  assert.ok(news.every((row) => row.ingestSource === "news"));
  assert.ok(news.some((row) => row.reviewStatus === "pending" && row.verified === false));
  assert.ok(news.some((row) => row.reviewStatus === "published" && row.verified === true));
  assert.ok(
    news.every(
      (row) =>
        (row.reviewStatus === "pending" && row.verified === false) ||
        (row.reviewStatus === "published" && row.verified === true) ||
        (row.reviewStatus === "rejected" && row.verified === false),
    ),
  );
  const prepared = prepareImports(root);
  assert.ok(prepared.fars.length > 3000);
  assert.ok(prepared.penndot.length > 4000);
  assert.ok(prepared.suppressed.farsCurated >= 1);
  assert.ok(prepared.suppressed.penndotFars >= 1);
});
