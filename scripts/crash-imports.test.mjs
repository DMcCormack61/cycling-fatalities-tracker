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

test("Nov 1 2026 desk sweep publishes confirmed crashes and queues the undated one", () => {
  const news = JSON.parse(readFileSync(join(root, "data/crash-imports/news.json"), "utf8"));
  const kirkpatrick = news.find((row) => row.id === "news-cf4b8958fe213d2e");
  assert.equal(kirkpatrick.victimName, "Shannon Kirkpatrick");
  assert.equal(kirkpatrick.reviewStatus, "published");
  assert.equal(kirkpatrick.verified, true);
  assert.equal(kirkpatrick.occurredOn, "2026-10-30");

  const mays = news.find((row) => row.id === "news-b8212b4f13a77c95");
  assert.equal(mays.victimName, 'William "Frank" Mays');
  assert.equal(mays.reviewStatus, "published");
  assert.equal(mays.verified, true);
  assert.equal(mays.fatalities, 1);
  assert.equal(mays.occurredOn, "2026-10-18");

  const phoenix = news.find((row) => row.id === "news-b32b49bfb7d77f23");
  assert.equal(phoenix.reviewStatus, "published");
  assert.equal(phoenix.verified, true);
  assert.equal(phoenix.injured, 2);
  assert.equal(phoenix.victimName, null);
  assert.equal(phoenix.occurredOn, "2026-10-30");

  const harris = news.find((row) => row.id === "news-c05fccba3dfff9a7");
  assert.equal(harris.victimName, "Corey Harris");
  assert.equal(harris.reviewStatus, "pending");
  assert.equal(harris.verified, false);
  assert.equal(harris.datePrecision, "published");
  assert.match(harris.context, /exact crash date is not stated/i);

  const ids = new Set(news.map((row) => row.id));
  assert.equal(ids.size, news.length);
  const prepared = prepareImports(root);
  for (const id of [kirkpatrick.id, mays.id, phoenix.id, harris.id]) {
    assert.ok(prepared.news.some((row) => row.id === id));
  }
});

test("Nov 2 2026 desk sweep publishes confirmed crashes and queues the rest", () => {
  const news = JSON.parse(readFileSync(join(root, "data/crash-imports/news.json"), "utf8"));
  const byId = new Map(news.map((row) => [row.id, row]));

  const donahue = byId.get("news-5abd54cf29b6d382");
  assert.equal(donahue.victimName, "Kenneth Donahue");
  assert.equal(donahue.reviewStatus, "published");
  assert.equal(donahue.verified, true);
  assert.equal(donahue.fatalities, 1);
  assert.equal(donahue.injured, 1);
  assert.equal(donahue.occurredOn, "2026-11-01");

  const butcher = byId.get("news-1247d458cf90c006");
  assert.equal(butcher.victimName, "Dean Edward Butcher");
  assert.equal(butcher.reviewStatus, "published");
  assert.equal(butcher.outcome, "killed");
  assert.equal(butcher.occurredOn, "2026-10-31");

  const wesley = byId.get("news-3204cc3f0b9c77d4");
  assert.equal(wesley.reviewStatus, "published");
  assert.equal(wesley.victimName, null);
  assert.equal(wesley.fatalities, 1);
  assert.equal(wesley.city, "Wesley Chapel");

  const colby = byId.get("news-dcb8f0b939be7d6e");
  assert.equal(colby.victimName, "Matthew Colby");
  assert.equal(colby.reviewStatus, "published");
  assert.equal(colby.injured, 1);
  assert.match(colby.summary, /Acura/);

  const honolulu = byId.get("news-eb48f5d669dd5656");
  assert.equal(honolulu.reviewStatus, "published");
  assert.equal(honolulu.helmet, "no");
  assert.equal(honolulu.severity, "critical");
  assert.equal(honolulu.occurredOn, "2026-10-30");

  const thomas = byId.get("news-5d99338b2f55b9f8");
  assert.equal(thomas.victimName, 'Sterling Wolfgang "Wolf" Thomas');
  assert.equal(thomas.reviewStatus, "published");
  assert.equal(thomas.vehicleType, "motorcycle");
  assert.equal(thomas.occurredOn, "2026-07-02");
  assert.equal(thomas.fatalities, 1);

  const dedham = byId.get("news-ce83070a9ed00ca9");
  assert.equal(dedham.reviewStatus, "pending");
  assert.equal(dedham.verified, false);
  assert.match(dedham.context, /injury is not stated/i);

  const train = byId.get("news-c0d9b5679633d2a0");
  assert.equal(train.reviewStatus, "pending");
  assert.match(train.context, /no motor vehicle/i);

  const mesa = byId.get("news-1264004e4ba33bf1");
  assert.equal(mesa.reviewStatus, "pending");
  assert.match(mesa.context, /not confirmed the three were riding bicycles/i);

  const rahman = byId.get("news-35c1bda03d710964");
  assert.match(rahman.summary, /Aaron K\. Tart Jr\./);
  assert.match(rahman.summary, /windshield/);
  assert.equal(rahman.reviewStatus, "published");

  const mays = byId.get("news-b8212b4f13a77c95");
  assert.match(mays.summary, /wheel well/);
  assert.equal(mays.reviewStatus, "published");

  const austin = byId.get("news-3f324f1f132214f8");
  assert.equal(austin.victimName, null);

  const ids = new Set(news.map((row) => row.id));
  assert.equal(ids.size, news.length);
  const prepared = prepareImports(root);
  for (const id of [donahue.id, butcher.id, wesley.id, colby.id, honolulu.id, thomas.id, dedham.id, train.id, mesa.id]) {
    assert.ok(prepared.news.some((row) => row.id === id), id);
  }
});
