import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { prepareImports } from "./load-crash-imports.mjs";
import { googleMapsSearchUrl } from "../src/lib/google-maps-url.mjs";

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

test("Nov 3 2026 desk sweep publishes confirmed crashes and skips the rest", () => {
  const news = JSON.parse(readFileSync(join(root, "data/crash-imports/news.json"), "utf8"));
  const byId = new Map(news.map((row) => [row.id, row]));

  const sacramento = byId.get("news-9386fb2d7730367f");
  assert.equal(sacramento.reviewStatus, "published");
  assert.equal(sacramento.verified, true);
  assert.equal(sacramento.outcome, "killed");
  assert.equal(sacramento.fatalities, 1);
  assert.equal(sacramento.victimName, null);
  assert.equal(sacramento.occurredOn, "2026-11-02");
  assert.equal(sacramento.vehicleType, "pickup");
  assert.equal(sacramento.roadwayType, "Stockton Boulevard");
  assert.equal(sacramento.city, "Sacramento");
  assert.match(sacramento.summary, /Victory Avenue/);

  const charleston = byId.get("news-f86a54867ec1e096");
  assert.equal(charleston.reviewStatus, "published");
  assert.equal(charleston.verified, true);
  assert.equal(charleston.fatalities, 1);
  assert.equal(charleston.victimName, "Christopher D. Skeens");
  assert.equal(charleston.occurredOn, "2026-11-02");
  assert.equal(charleston.city, "South Charleston");
  assert.equal(charleston.stateCode, "WV");
  assert.match(charleston.summary, /4100 block of MacCorkle Avenue/);
  assert.match(charleston.context, /400 block/);

  const hubbard = byId.get("news-751af9ac5112d31b");
  assert.equal(hubbard.victimName, "Andre J. Hubbard");
  assert.equal(hubbard.reviewStatus, "published");
  assert.equal(hubbard.verified, true);
  assert.equal(hubbard.outcome, "serious_injury");
  assert.equal(hubbard.injured, 1);
  assert.equal(hubbard.fatalities, 0);
  assert.equal(hubbard.occurredOn, "2026-11-01");
  assert.equal(hubbard.helmet, "no");
  assert.equal(hubbard.vehicleType, "SUV");
  assert.match(hubbard.summary, /Volkswagen Atlas/);

  const rahman = byId.get("news-35c1bda03d710964");
  assert.equal(rahman.reviewStatus, "published");
  assert.equal(rahman.victimName, "Maksudur Rahman");
  assert.equal(
    news.filter((row) => row.city === "Voorhees" && row.roadwayType === "Route 73").length,
    1,
  );
  assert.equal(
    news.some((row) => /wilson way/i.test(`${row.summary} ${row.locationName}`)),
    false,
  );

  const ids = new Set(news.map((row) => row.id));
  assert.equal(ids.size, news.length);
  const prepared = prepareImports(root);
  for (const id of [sacramento.id, charleston.id, hubbard.id, rahman.id]) {
    assert.ok(prepared.news.some((row) => row.id === id), id);
  }
});

test("Nov 5 2026 desk sweep publishes the day's confirmed crashes", () => {
  const news = JSON.parse(readFileSync(join(root, "data/crash-imports/news.json"), "utf8"));
  const byId = new Map(news.map((row) => [row.id, row]));

  const grandPrairie = byId.get("news-cf9b6ba38c284b14");
  assert.equal(grandPrairie.reviewStatus, "published");
  assert.equal(grandPrairie.verified, true);
  assert.equal(grandPrairie.outcome, "killed");
  assert.equal(grandPrairie.fatalities, 1);
  assert.equal(grandPrairie.victimName, null);
  assert.equal(grandPrairie.occurredOn, "2026-11-03");
  assert.equal(grandPrairie.city, "Grand Prairie");
  assert.equal(grandPrairie.stateCode, "TX");
  assert.equal(grandPrairie.driverStatus, "at_scene");
  assert.match(grandPrairie.summary, /Bill Irwin Street/);
  assert.equal(grandPrairie.latitude, 32.74921);

  const eriksen = byId.get("news-75ffef76ffa73801");
  assert.equal(eriksen.victimName, "Frances Max Eriksen");
  assert.equal(eriksen.reviewStatus, "published");
  assert.equal(eriksen.verified, true);
  assert.equal(eriksen.outcome, "killed");
  assert.equal(eriksen.occurredOn, "2026-11-03");
  assert.equal(eriksen.city, "Maricopa");
  assert.equal(eriksen.driverStatus, "unknown");
  assert.match(eriksen.context, /hit-and-run/);

  const gag = byId.get("news-a281fd8236da1def");
  assert.equal(gag.victimName, "Louisa Gag");
  assert.equal(gag.reviewStatus, "published");
  assert.equal(gag.verified, true);
  assert.equal(gag.fatalities, 1);
  assert.equal(gag.occurredOn, "2026-07-09");
  assert.equal(gag.city, "Boston");
  assert.equal(gag.vehicleType, "truck");
  assert.match(gag.summary, /Parker Street/);

  const withrow = byId.get("news-659f8c3a194b65a2");
  assert.equal(withrow.victimName, 'Catherine "Cate" Withrow');
  assert.equal(withrow.reviewStatus, "published");
  assert.equal(withrow.verified, true);
  assert.equal(withrow.occurredOn, "2026-07-06");
  assert.equal(withrow.city, "Fort Collins");
  assert.equal(withrow.vehicleType, "truck");
  assert.match(withrow.summary, /Baldivia/);

  const redmond = byId.get("news-a38b60511646dff8");
  assert.equal(redmond.reviewStatus, "published");
  assert.equal(redmond.outcome, "serious_injury");
  assert.equal(redmond.severity, "high");
  assert.equal(redmond.crashType, "hit-and-run");
  assert.equal(redmond.driverStatus, "fled");
  assert.equal(redmond.city, "Redmond");
  assert.equal(redmond.occurredOn, "2026-11-04");

  const flint = byId.get("news-3b12442cc0ff2179");
  assert.equal(flint.reviewStatus, "published");
  assert.equal(flint.severity, "critical");
  assert.equal(flint.vehicleType, "SUV");
  assert.equal(flint.driverStatus, "at_scene");
  assert.equal(flint.city, "Flint");
  assert.match(flint.summary, /Jeep Grand Cherokee/);

  const scottsdale = byId.get("news-6e18f5aa62844956");
  assert.equal(scottsdale.reviewStatus, "published");
  assert.equal(scottsdale.city, "Scottsdale");
  assert.equal(scottsdale.severity, "critical");
  assert.equal(scottsdale.crashType, "intersection");
  assert.match(scottsdale.summary, /Lone Mountain/);

  const tempe = byId.get("news-29989c6379fa87a4");
  assert.equal(tempe.reviewStatus, "published");
  assert.equal(tempe.city, "Tempe");
  assert.equal(tempe.severity, "critical");
  assert.equal(tempe.outcome, "killed");
  assert.equal(tempe.fatalities, 1);
  assert.equal(tempe.injured, 0);
  assert.equal(tempe.driverStatus, "at_scene");
  assert.match(tempe.summary, /McKellips/);

  const damariscotta = byId.get("news-0e1a7189e18a7694");
  assert.equal(damariscotta.reviewStatus, "published");
  assert.equal(damariscotta.city, "Damariscotta");
  assert.equal(damariscotta.crashType, "hit-and-run");
  assert.equal(damariscotta.driverStatus, "fled");
  assert.equal(damariscotta.severity, "high");
  assert.equal(damariscotta.victimAgeBand, "60\u201369");

  const martinville = byId.get("news-119b9830653954a1");
  assert.equal(martinville.reviewStatus, "published");
  assert.equal(martinville.city, "St. Martinville");
  assert.equal(martinville.severity, "critical");
  assert.equal(martinville.vehicleType, "truck");
  assert.match(martinville.summary, /Port Street/);

  const beekmantown = byId.get("news-4f345677a867d766");
  assert.equal(beekmantown.reviewStatus, "published");
  assert.equal(beekmantown.city, "Beekmantown");
  assert.equal(beekmantown.severity, "moderate");
  assert.equal(beekmantown.latitude, null);
  assert.equal(beekmantown.longitude, null);
  assert.match(beekmantown.context, /no pin/i);
  assert.match(beekmantown.summary, /Spellman Road/);

  const added = [
    grandPrairie,
    eriksen,
    gag,
    withrow,
    redmond,
    flint,
    scottsdale,
    tempe,
    damariscotta,
    martinville,
    beekmantown,
  ];
  assert.equal(added.filter((row) => row.outcome === "killed").length, 5);
  assert.equal(added.filter((row) => row.outcome === "serious_injury").length, 6);
  assert.ok(added.every((row) => row.verified === true && row.reviewStatus === "published"));
  assert.ok(added.every((row) => row.ingestSource === "news" && row.datePrecision === "day"));

  const ids = new Set(news.map((row) => row.id));
  assert.equal(ids.size, news.length);
  const prepared = prepareImports(root);
  for (const row of added) {
    assert.ok(
      prepared.news.some((item) => item.id === row.id),
      row.id,
    );
  }
});

test("Nov 6 2026 desk sweep publishes confirmed crashes and records the Tempe death", () => {
  const news = JSON.parse(readFileSync(join(root, "data/crash-imports/news.json"), "utf8"));
  const byId = new Map(news.map((row) => [row.id, row]));

  const columbus = byId.get("news-d325ff8dd5acd45b");
  assert.equal(columbus.reviewStatus, "published");
  assert.equal(columbus.verified, true);
  assert.equal(columbus.outcome, "killed");
  assert.equal(columbus.fatalities, 1);
  assert.equal(columbus.injured, 0);
  assert.equal(columbus.victimName, "Dion Watts");
  assert.equal(columbus.occurredOn, "2026-11-05");
  assert.equal(columbus.city, "Columbus");
  assert.equal(columbus.stateCode, "OH");
  assert.equal(columbus.crashType, "intersection");
  assert.equal(columbus.driverStatus, "at_scene");
  assert.equal(columbus.lighting, "dark");
  assert.match(columbus.summary, /Kenny Road/);
  assert.match(columbus.summary, /7:37/);
  assert.equal(columbus.latitude, 40.00665);

  const elkGrove = byId.get("news-6ee8392311b134eb");
  assert.equal(elkGrove.reviewStatus, "published");
  assert.equal(elkGrove.verified, true);
  assert.equal(elkGrove.outcome, "serious_injury");
  assert.equal(elkGrove.severity, "critical");
  assert.equal(elkGrove.victimAgeBand, "70\u201379");
  assert.equal(elkGrove.victimName, null);
  assert.equal(elkGrove.helmet, "no");
  assert.equal(elkGrove.driverStatus, "at_scene");
  assert.equal(elkGrove.city, "Elk Grove");
  assert.equal(elkGrove.occurredOn, "2026-11-05");
  assert.match(elkGrove.summary, /Matina Drive/);
  assert.equal(elkGrove.latitude, 38.38205);

  const batavia = byId.get("news-0338287e98d92ce6");
  assert.equal(batavia.reviewStatus, "published");
  assert.equal(batavia.verified, true);
  assert.equal(batavia.outcome, "serious_injury");
  assert.equal(batavia.severity, "high");
  assert.equal(batavia.crashType, "hit-and-run");
  assert.equal(batavia.driverStatus, "fled");
  assert.equal(batavia.vehicleType, "car");
  assert.equal(batavia.victimName, null);
  assert.equal(batavia.city, "Batavia");
  assert.equal(batavia.stateCode, "NY");
  assert.equal(batavia.occurredOn, "2026-11-05");
  assert.equal(batavia.latitude, null);
  assert.equal(batavia.longitude, null);
  assert.match(batavia.summary, /North Spruce Street/);
  assert.match(batavia.summary, /Altima/);
  assert.match(batavia.context, /no pin/i);
  assert.equal(byId.get("news-622b83864458e7b9"), undefined);

  const albertLea = byId.get("news-f9b8b135d5c43c40");
  assert.equal(albertLea.reviewStatus, "published");
  assert.equal(albertLea.verified, true);
  assert.equal(albertLea.outcome, "serious_injury");
  assert.equal(albertLea.severity, "low");
  assert.equal(albertLea.victimAgeBand, "10\u201319");
  assert.equal(albertLea.victimName, null);
  assert.equal(albertLea.city, "Albert Lea");
  assert.equal(albertLea.occurredOn, "2026-11-04");
  assert.match(albertLea.summary, /Madison Avenue/);
  assert.equal(albertLea.latitude, 43.64343);

  const battleCreek = byId.get("news-cecadb8c2c548739");
  assert.equal(battleCreek.reviewStatus, "published");
  assert.equal(battleCreek.verified, true);
  assert.equal(battleCreek.outcome, "killed");
  assert.equal(battleCreek.fatalities, 1);
  assert.equal(battleCreek.injured, 0);
  assert.equal(battleCreek.victimName, "David Webster");
  assert.equal(battleCreek.victimAgeBand, "80\u201389");
  assert.equal(battleCreek.driverStatus, "at_scene");
  assert.equal(battleCreek.city, "Battle Creek");
  assert.equal(battleCreek.stateCode, "MI");
  assert.equal(battleCreek.occurredOn, "2026-11-03");
  assert.match(battleCreek.summary, /Cherrywood Lane/);
  assert.equal(battleCreek.latitude, 42.28955);

  const hyannis = byId.get("news-29a0f5274e17b2eb");
  assert.equal(hyannis.reviewStatus, "published");
  assert.equal(hyannis.verified, true);
  assert.equal(hyannis.outcome, "serious_injury");
  assert.equal(hyannis.severity, "high");
  assert.equal(hyannis.crashType, "intersection");
  assert.equal(hyannis.vehicleType, "car");
  assert.equal(hyannis.city, "Hyannis");
  assert.equal(hyannis.stateCode, "MA");
  assert.equal(hyannis.occurredOn, "2026-11-02");
  assert.match(hyannis.summary, /Rosary Road/);
  assert.equal(hyannis.latitude, 41.67099);

  const laredo = byId.get("news-107355a29a91fdf0");
  assert.equal(laredo.reviewStatus, "published");
  assert.equal(laredo.verified, true);
  assert.equal(laredo.outcome, "serious_injury");
  assert.equal(laredo.severity, "high");
  assert.equal(laredo.crashType, "hit-and-run");
  assert.equal(laredo.driverStatus, "charged");
  assert.equal(laredo.victimName, null);
  assert.equal(laredo.victimAgeBand, "20\u201329");
  assert.equal(laredo.city, "Laredo");
  assert.equal(laredo.stateCode, "TX");
  assert.equal(laredo.occurredOn, "2026-11-01");
  assert.match(laredo.summary, /Mauro Sandoval/);
  assert.match(laredo.summary, /Zapata/);
  assert.equal(laredo.latitude, 27.49582);

  const wilson = byId.get("news-260856213f6225ac");
  assert.equal(wilson.victimName, "Autumn D. Wilson");
  assert.equal(wilson.reviewStatus, "published");
  assert.equal(wilson.verified, true);
  assert.equal(wilson.outcome, "serious_injury");
  assert.equal(wilson.severity, "moderate");
  assert.equal(wilson.victimAgeBand, "20\u201329");
  assert.equal(wilson.vehicleType, "pickup");
  assert.equal(wilson.city, "Sugarcreek Borough");
  assert.equal(wilson.stateCode, "PA");
  assert.equal(wilson.occurredOn, "2026-10-30");
  assert.match(wilson.summary, /Gibb Road/);
  assert.equal(wilson.latitude, 41.40479);

  const tempe = byId.get("news-29989c6379fa87a4");
  assert.equal(tempe.outcome, "killed");
  assert.equal(tempe.fatalities, 1);
  assert.equal(tempe.injured, 0);
  assert.equal(tempe.severity, "critical");
  assert.equal(tempe.city, "Tempe");
  assert.equal(tempe.latitude, 33.45123);
  assert.equal(tempe.longitude, -111.92656);
  assert.match(tempe.title, /killed/);
  assert.match(tempe.summary, /later died/);
  assert.match(tempe.summary, /McKellips/);

  const added = [columbus, elkGrove, batavia, albertLea, battleCreek, hyannis, laredo, wilson];
  assert.equal(added.filter((row) => row.outcome === "killed").length, 2);
  assert.equal(added.filter((row) => row.outcome === "serious_injury").length, 6);
  assert.ok(added.every((row) => row.verified === true && row.reviewStatus === "published"));
  assert.ok(added.every((row) => row.ingestSource === "news" && row.datePrecision === "day"));

  const ids = new Set(news.map((row) => row.id));
  assert.equal(ids.size, news.length);
  const prepared = prepareImports(root);
  for (const row of [...added, tempe]) {
    assert.ok(
      prepared.news.some((item) => item.id === row.id),
      row.id,
    );
  }
});

test("Nov 7 2026 desk sweep names two riders and publishes the day's confirmed crashes", () => {
  const news = JSON.parse(readFileSync(join(root, "data/crash-imports/news.json"), "utf8"));
  const byId = new Map(news.map((row) => [row.id, row]));

  const columbus = byId.get("news-d325ff8dd5acd45b");
  assert.equal(columbus.victimName, "Dion Watts");
  assert.equal(columbus.victimAgeBand, "20\u201329");
  assert.equal(columbus.vehicleType, "SUV");
  assert.equal(columbus.reviewStatus, "published");
  assert.equal(columbus.verified, true);
  assert.equal(columbus.outcome, "killed");
  assert.equal(columbus.occurredOn, "2026-11-05");
  assert.equal(columbus.latitude, 40.00665);
  assert.equal(columbus.longitude, -83.03423);
  assert.match(columbus.summary, /Porsche Cayenne/);
  assert.match(columbus.summary, /Preston Avenue/);
  assert.match(columbus.context, /Lane Avenue/);

  const battleCreek = byId.get("news-cecadb8c2c548739");
  assert.equal(battleCreek.victimName, "David Webster");
  assert.equal(battleCreek.victimAgeBand, "80\u201389");
  assert.equal(battleCreek.reviewStatus, "published");
  assert.equal(battleCreek.verified, true);
  assert.equal(battleCreek.outcome, "killed");
  assert.equal(battleCreek.occurredOn, "2026-11-03");
  assert.equal(battleCreek.latitude, 42.28955);
  assert.match(battleCreek.summary, /Woodland Church/);
  assert.match(battleCreek.summary, /Cherrywood Lane/);

  const vicksburg = byId.get("news-97facf22283c4d4c");
  assert.equal(vicksburg.reviewStatus, "published");
  assert.equal(vicksburg.verified, true);
  assert.equal(vicksburg.outcome, "serious_injury");
  assert.equal(vicksburg.severity, "moderate");
  assert.equal(vicksburg.crashType, "hit-and-run");
  assert.equal(vicksburg.driverStatus, "charged");
  assert.equal(vicksburg.vehicleType, "pickup");
  assert.equal(vicksburg.victimName, null);
  assert.equal(vicksburg.city, "Vicksburg");
  assert.equal(vicksburg.stateCode, "MS");
  assert.equal(vicksburg.occurredOn, "2026-11-06");
  assert.match(vicksburg.summary, /Nissan Titan/);
  assert.match(vicksburg.summary, /leg pain/);
  assert.equal(vicksburg.latitude, 32.3237);

  const honolulu = byId.get("news-bd920cc9ff932acc");
  assert.equal(honolulu.reviewStatus, "published");
  assert.equal(honolulu.verified, true);
  assert.equal(honolulu.outcome, "serious_injury");
  assert.equal(honolulu.severity, "critical");
  assert.equal(honolulu.vehicleType, "bus");
  assert.equal(honolulu.helmet, "no");
  assert.equal(honolulu.victimName, null);
  assert.equal(honolulu.victimAgeBand, "10\u201319");
  assert.equal(honolulu.driverStatus, "at_scene");
  assert.equal(honolulu.city, "Honolulu");
  assert.equal(honolulu.stateCode, "HI");
  assert.equal(honolulu.occurredOn, "2026-11-06");
  assert.match(honolulu.summary, /Laumaka Street/);
  assert.equal(honolulu.latitude, 21.33088);

  const chicago = byId.get("news-9e7e606a74a96a0a");
  assert.equal(chicago.reviewStatus, "pending");
  assert.equal(chicago.verified, false);
  assert.equal(chicago.outcome, "killed");
  assert.equal(chicago.fatalities, 1);
  assert.equal(chicago.victimName, null);
  assert.equal(chicago.victimAgeBand, "60\u201369");
  assert.equal(chicago.vehicleType, "SUV");
  assert.equal(chicago.city, "Chicago");
  assert.equal(chicago.occurredOn, "2026-11-06");
  assert.match(chicago.context, /not confirmed as a bicycle/i);
  assert.match(chicago.summary, /stand-up electric scooter/);
  assert.equal(chicago.latitude, 41.99037);
  assert.equal(
    news.some((row) => /armour square/i.test(row.summary) && row.reviewStatus === "published"),
    false,
  );

  const sanDiego = byId.get("news-a5e70d1181e2e4b4");
  assert.equal(sanDiego.reviewStatus, "published");
  assert.equal(sanDiego.verified, true);
  assert.equal(sanDiego.outcome, "serious_injury");
  assert.equal(sanDiego.severity, "high");
  assert.equal(sanDiego.vehicleType, "truck");
  assert.equal(sanDiego.victimName, null);
  assert.equal(sanDiego.victimAgeBand, "50\u201359");
  assert.equal(sanDiego.city, "San Diego");
  assert.equal(sanDiego.stateCode, "CA");
  assert.equal(sanDiego.occurredOn, "2026-11-05");
  assert.match(sanDiego.summary, /Ford F-650/);
  assert.match(sanDiego.summary, /6000 Miramar Road/);
  assert.equal(sanDiego.latitude, 32.87727);

  const elkton = byId.get("news-dae4bd53a1be9af5");
  assert.equal(elkton.reviewStatus, "published");
  assert.equal(elkton.verified, true);
  assert.equal(elkton.outcome, "serious_injury");
  assert.equal(elkton.severity, "high");
  assert.equal(elkton.crashType, "intersection");
  assert.equal(elkton.victimName, null);
  assert.equal(elkton.city, "Elkton");
  assert.equal(elkton.stateCode, "MD");
  assert.equal(elkton.occurredOn, "2026-11-05");
  assert.match(elkton.summary, /Howard Street/);
  assert.equal(elkton.latitude, 39.60567);

  const middlebury = byId.get("news-97a08d3c19e3d787");
  assert.equal(middlebury.reviewStatus, "published");
  assert.equal(middlebury.verified, true);
  assert.equal(middlebury.outcome, "serious_injury");
  assert.equal(middlebury.severity, "low");
  assert.equal(middlebury.crashType, "hit-and-run");
  assert.equal(middlebury.driverStatus, "fled");
  assert.equal(middlebury.vehicleType, "SUV");
  assert.equal(middlebury.victimName, null);
  assert.equal(middlebury.city, "Middlebury");
  assert.equal(middlebury.stateCode, "VT");
  assert.equal(middlebury.occurredOn, "2026-10-26");
  assert.match(middlebury.summary, /Subaru Crosstrek/);
  assert.match(middlebury.summary, /minor injuries/);
  assert.equal(middlebury.latitude, 44.01302);

  const published = [vicksburg, honolulu, sanDiego, elkton, middlebury];
  assert.equal(published.filter((row) => row.outcome === "serious_injury").length, 5);
  assert.ok(published.every((row) => row.verified === true && row.reviewStatus === "published"));
  assert.ok(published.every((row) => row.ingestSource === "news" && row.datePrecision === "day"));
  assert.equal(chicago.reviewStatus, "pending");

  const ids = new Set(news.map((row) => row.id));
  assert.equal(ids.size, news.length);
  const prepared = prepareImports(root);
  for (const row of [...published, chicago, columbus, battleCreek]) {
    assert.ok(
      prepared.news.some((item) => item.id === row.id),
      row.id,
    );
  }
});

test("Nov 8 2026 desk sweep publishes confirmed crashes and queues the Tuttle Avenue incident", () => {
  const news = JSON.parse(readFileSync(join(root, "data/crash-imports/news.json"), "utf8"));
  const penndot = JSON.parse(readFileSync(join(root, "data/crash-imports/penndot.json"), "utf8"));
  const byId = new Map(news.map((row) => [row.id, row]));

  const holly = byId.get("news-ad409e4ff3428367");
  assert.equal(holly.reviewStatus, "published");
  assert.equal(holly.verified, true);
  assert.equal(holly.outcome, "killed");
  assert.equal(holly.severity, "critical");
  assert.equal(holly.fatalities, 1);
  assert.equal(holly.injured, 20);
  assert.equal(holly.victimName, "Patrick Allen Turner");
  assert.equal(holly.victimAgeBand, "60\u201369");
  assert.equal(holly.crashType, "hit-and-run");
  assert.equal(holly.driverStatus, "charged");
  assert.equal(holly.vehicleType, "car");
  assert.equal(holly.city, "Holly Springs");
  assert.equal(holly.stateCode, "NC");
  assert.equal(holly.occurredOn, "2026-11-07");
  assert.equal(holly.lighting, "daylight");
  assert.match(holly.summary, /Optimist Farm Road/);
  assert.match(holly.summary, /Talicud Trail/);
  assert.match(holly.summary, /Donald Robert Morris-Jones/);
  assert.match(holly.summary, /Capital Cycling Club/);
  assert.equal(holly.latitude, 35.66183);
  assert.equal(holly.longitude, -78.77253);
  assert.ok(news[0].occurredOn >= holly.occurredOn);

  const gibsonton = byId.get("news-29e3e38ab745a5a8");
  assert.equal(gibsonton.reviewStatus, "published");
  assert.equal(gibsonton.verified, true);
  assert.equal(gibsonton.outcome, "killed");
  assert.equal(gibsonton.fatalities, 1);
  assert.equal(gibsonton.injured, 0);
  assert.equal(gibsonton.victimName, null);
  assert.equal(gibsonton.crashType, "hit-from-behind");
  assert.equal(gibsonton.driverStatus, "charged");
  assert.equal(gibsonton.vehicleType, "car");
  assert.equal(gibsonton.city, "Gibsonton");
  assert.equal(gibsonton.stateCode, "FL");
  assert.equal(gibsonton.occurredOn, "2026-11-07");
  assert.equal(gibsonton.lighting, "dark");
  assert.match(gibsonton.summary, /Michael Barr/);
  assert.match(gibsonton.summary, /0\.162/);
  assert.match(gibsonton.summary, /west shoulder/);
  assert.equal(gibsonton.latitude, 27.86741);
  assert.equal(gibsonton.longitude, -82.38643);

  const fruitville = byId.get("news-ebdeef28d2685297");
  assert.equal(fruitville.reviewStatus, "published");
  assert.equal(fruitville.verified, true);
  assert.equal(fruitville.outcome, "serious_injury");
  assert.equal(fruitville.severity, "high");
  assert.equal(fruitville.victimName, null);
  assert.equal(fruitville.vehicleType, "pickup");
  assert.equal(fruitville.crashType, "intersection");
  assert.equal(fruitville.city, "Sarasota");
  assert.equal(fruitville.stateCode, "FL");
  assert.equal(fruitville.occurredOn, "2026-11-07");
  assert.equal(fruitville.lighting, "daylight");
  assert.match(fruitville.summary, /Brink Avenue/);
  assert.match(fruitville.summary, /condition/);
  assert.equal(fruitville.latitude, 27.33745);
  assert.equal(fruitville.longitude, -82.50992);

  const newberry = byId.get("news-8bc626f73b893a77");
  assert.equal(newberry.reviewStatus, "published");
  assert.equal(newberry.verified, true);
  assert.equal(newberry.outcome, "serious_injury");
  assert.equal(newberry.severity, "low");
  assert.equal(newberry.victimName, null);
  assert.equal(newberry.driverStatus, "charged");
  assert.equal(newberry.crashType, "intersection");
  assert.equal(newberry.city, "Newberry");
  assert.equal(newberry.stateCode, "FL");
  assert.equal(newberry.occurredOn, "2026-11-05");
  assert.match(newberry.summary, /Oak View Middle School/);
  assert.match(newberry.summary, /minor scrapes/);
  assert.equal(newberry.latitude, 29.63911);
  assert.equal(newberry.longitude, -82.60659);

  const tuttle = byId.get("news-28f3cfbae6175db2");
  assert.equal(tuttle.reviewStatus, "pending");
  assert.equal(tuttle.verified, false);
  assert.equal(tuttle.outcome, "serious_injury");
  assert.equal(tuttle.city, "Sarasota");
  assert.equal(tuttle.occurredOn, "2026-11-05");
  assert.equal(tuttle.vehicleType, null);
  assert.match(tuttle.context, /No motor vehicle was confirmed/);
  assert.match(tuttle.summary, /Girls Inc/);
  assert.equal(tuttle.latitude, 27.33647);
  assert.equal(tuttle.longitude, -82.51404);

  const somersetOfficial = penndot.find((row) => row.id === "penndot-2025090261");
  assert.equal(somersetOfficial.fatalities, 1);
  assert.equal(somersetOfficial.occurredOn, "2025-09-01");
  assert.equal(somersetOfficial.datePrecision, "month");
  assert.equal(somersetOfficial.city, "Somerset County");
  assert.equal(
    news.some((row) => row.victimName === "Aaron Lancaster" || /10770 Somerset Pike/.test(row.summary)),
    false,
  );

  const published = [holly, gibsonton, fruitville, newberry];
  assert.equal(published.filter((row) => row.outcome === "killed").length, 2);
  assert.equal(published.filter((row) => row.outcome === "serious_injury").length, 2);
  assert.ok(published.every((row) => row.verified === true && row.reviewStatus === "published"));
  assert.ok(published.every((row) => row.ingestSource === "news" && row.datePrecision === "day"));
  assert.equal(tuttle.reviewStatus, "pending");

  const ids = new Set(news.map((row) => row.id));
  assert.equal(ids.size, news.length);
  const prepared = prepareImports(root);
  for (const row of [...published, tuttle]) {
    assert.ok(
      prepared.news.some((item) => item.id === row.id),
      row.id,
    );
  }
});

test("Nov 10 2026 desk sweep publishes confirmed crashes and queues the Chicago pedicab", () => {
  const news = JSON.parse(readFileSync(join(root, "data/crash-imports/news.json"), "utf8"));
  const byId = new Map(news.map((row) => [row.id, row]));

  const katy = byId.get("news-617218ca3f9e390e");
  assert.equal(katy.reviewStatus, "published");
  assert.equal(katy.verified, true);
  assert.equal(katy.outcome, "killed");
  assert.equal(katy.severity, "critical");
  assert.equal(katy.fatalities, 1);
  assert.equal(katy.injured, 0);
  assert.equal(katy.victimName, "Chinwe Keisha Egbo");
  assert.equal(katy.victimAgeBand, "20\u201329");
  assert.equal(katy.crashType, "hit-and-run");
  assert.equal(katy.driverStatus, "charged");
  assert.equal(katy.vehicleType, "SUV");
  assert.equal(katy.city, "Katy");
  assert.equal(katy.stateCode, "TX");
  assert.equal(katy.occurredOn, "2026-11-08");
  assert.equal(katy.lighting, "dark");
  assert.match(katy.summary, /Pitts Road/);
  assert.match(katy.summary, /Trianna Denise Walker/);
  assert.match(katy.summary, /failure to stop and render aid/);
  assert.match(katy.context, /KHOU reported the same Pitts Road crash/);
  assert.equal(katy.latitude, 29.83111);
  assert.equal(katy.longitude, -95.84019);
  assert.equal(katy.sourceName, "FOX 26 Houston");
  assert.ok(news[0].occurredOn >= katy.occurredOn);

  const gulf = byId.get("news-71ea297ef82a1825");
  assert.equal(gulf.reviewStatus, "published");
  assert.equal(gulf.verified, true);
  assert.equal(gulf.outcome, "killed");
  assert.equal(gulf.fatalities, 1);
  assert.equal(gulf.injured, 0);
  assert.equal(gulf.victimName, null);
  assert.equal(gulf.crashType, "intersection");
  assert.equal(gulf.driverStatus, "at_scene");
  assert.equal(gulf.vehicleType, "car");
  assert.equal(gulf.city, "Gulf Breeze");
  assert.equal(gulf.stateCode, "FL");
  assert.equal(gulf.occurredOn, "2026-11-08");
  assert.equal(gulf.lighting, "dark");
  assert.match(gulf.summary, /Portside Drive/);
  assert.match(gulf.summary, /19-year-old/);
  assert.equal(gulf.latitude, 30.3904);
  assert.equal(gulf.longitude, -87.06243);

  const greensboro = byId.get("news-ed7ee6886cee2b8e");
  assert.equal(greensboro.reviewStatus, "published");
  assert.equal(greensboro.verified, true);
  assert.equal(greensboro.outcome, "killed");
  assert.equal(greensboro.fatalities, 1);
  assert.equal(greensboro.victimName, "Napoleon Ellerbe");
  assert.equal(greensboro.victimAgeBand, "30\u201339");
  assert.equal(greensboro.crashType, "other");
  assert.equal(greensboro.driverStatus, "at_scene");
  assert.equal(greensboro.vehicleType, "SUV");
  assert.equal(greensboro.city, "Greensboro");
  assert.equal(greensboro.stateCode, "NC");
  assert.equal(greensboro.occurredOn, "2026-11-07");
  assert.match(greensboro.summary, /Reedy Fork Parkway/);
  assert.match(greensboro.summary, /Cadillac SRX/);
  assert.match(greensboro.context, /FOX8 WGHP/);
  assert.equal(greensboro.latitude, 36.17567);
  assert.equal(greensboro.longitude, -79.71214);

  const missaukee = byId.get("news-a411145719115faf");
  assert.equal(missaukee.reviewStatus, "published");
  assert.equal(missaukee.verified, true);
  assert.equal(missaukee.outcome, "killed");
  assert.equal(missaukee.fatalities, 1);
  assert.equal(missaukee.victimName, null);
  assert.equal(missaukee.victimAgeBand, "30\u201339");
  assert.equal(missaukee.crashType, "hit-from-behind");
  assert.equal(missaukee.vehicleType, null);
  assert.equal(missaukee.city, "Clam Union Township");
  assert.equal(missaukee.stateCode, "MI");
  assert.equal(missaukee.occurredOn, "2026-11-07");
  assert.equal(missaukee.lighting, "dark");
  assert.match(missaukee.summary, /Prosper Road/);
  assert.match(missaukee.summary, /eastbound/);
  assert.match(missaukee.context, /A motor vehicle was involved/);
  assert.equal(missaukee.latitude, 44.24302);
  assert.equal(missaukee.longitude, -85.0435);

  const chicago = byId.get("news-8c3425353a202637");
  assert.equal(chicago.reviewStatus, "pending");
  assert.equal(chicago.verified, false);
  assert.equal(chicago.outcome, "serious_injury");
  assert.equal(chicago.city, "Chicago");
  assert.equal(chicago.stateCode, "IL");
  assert.equal(chicago.occurredOn, "2026-11-08");
  assert.equal(chicago.vehicleType, "car");
  assert.match(chicago.context, /Not confirmed as a bicycle/);
  assert.match(chicago.summary, /pedicab/);
  assert.equal(chicago.latitude, 41.87322);
  assert.equal(chicago.longitude, -87.6206);

  const published = [katy, gulf, greensboro, missaukee];
  assert.equal(published.filter((row) => row.outcome === "killed").length, 4);
  assert.equal(published.filter((row) => row.outcome === "serious_injury").length, 0);
  assert.ok(published.every((row) => row.verified === true && row.reviewStatus === "published"));
  assert.ok(published.every((row) => row.ingestSource === "news" && row.datePrecision === "day"));
  assert.equal(chicago.reviewStatus, "pending");
  assert.equal(
    news.filter((row) => row.victimName === "Chinwe Keisha Egbo" || /4100 block of Pitts Road/.test(row.summary))
      .length,
    1,
  );

  const ids = new Set(news.map((row) => row.id));
  assert.equal(ids.size, news.length);
  const prepared = prepareImports(root);
  for (const row of [...published, chicago]) {
    assert.ok(
      prepared.news.some((item) => item.id === row.id),
      row.id,
    );
  }
});

test("Nov 11 2026 desk sweep publishes confirmed crashes and queues the Armour dispatch", () => {
  const news = JSON.parse(readFileSync(join(root, "data/crash-imports/news.json"), "utf8"));
  const byId = new Map(news.map((row) => [row.id, row]));

  const phenix = byId.get("news-834703803975d7d3");
  assert.equal(phenix.reviewStatus, "published");
  assert.equal(phenix.verified, true);
  assert.equal(phenix.outcome, "killed");
  assert.equal(phenix.severity, "critical");
  assert.equal(phenix.fatalities, 1);
  assert.equal(phenix.injured, 0);
  assert.equal(phenix.victimName, null);
  assert.equal(phenix.victimAgeBand, "30\u201339");
  assert.equal(phenix.crashType, "intersection");
  assert.equal(phenix.driverStatus, "unknown");
  assert.equal(phenix.vehicleType, null);
  assert.equal(phenix.city, "Phenix City");
  assert.equal(phenix.stateCode, "AL");
  assert.equal(phenix.occurredOn, "2026-11-10");
  assert.equal(phenix.lighting, "dark");
  assert.match(phenix.summary, /Sandfort Road/);
  assert.match(phenix.summary, /10:10/);
  assert.match(phenix.summary, /Arthur Sumbry Jr/);
  assert.match(phenix.context, /16th Avenue North/);
  assert.equal(phenix.latitude, 32.45625);
  assert.equal(phenix.longitude, -85.01512);
  assert.equal(
    news.filter((row) => row.victimName === "Bartlo Pascual-Bartlome").length,
    0,
  );

  const leesburg = byId.get("news-f048de12728a81c1");
  assert.equal(leesburg.reviewStatus, "published");
  assert.equal(leesburg.verified, true);
  assert.equal(leesburg.outcome, "killed");
  assert.equal(leesburg.fatalities, 1);
  assert.equal(leesburg.injured, 0);
  assert.equal(leesburg.victimName, null);
  assert.equal(leesburg.victimAgeBand, "30\u201339");
  assert.equal(leesburg.crashType, "intersection");
  assert.equal(leesburg.driverStatus, "charged");
  assert.equal(leesburg.vehicleType, "pickup");
  assert.equal(leesburg.city, "Leesburg");
  assert.equal(leesburg.stateCode, "VA");
  assert.equal(leesburg.occurredOn, "2026-11-10");
  assert.equal(leesburg.lighting, "dark");
  assert.match(leesburg.summary, /Clayton P\. Templeton/);
  assert.match(leesburg.summary, /Prosperity Avenue/);
  assert.equal(leesburg.latitude, 39.10639);
  assert.equal(leesburg.longitude, -77.54789);

  const kansasCity = byId.get("news-537e205d87430371");
  assert.equal(kansasCity.reviewStatus, "published");
  assert.equal(kansasCity.verified, true);
  assert.equal(kansasCity.outcome, "serious_injury");
  assert.equal(kansasCity.severity, "critical");
  assert.equal(kansasCity.helmet, "no");
  assert.equal(kansasCity.vehicleType, "SUV");
  assert.equal(kansasCity.driverStatus, "at_scene");
  assert.equal(kansasCity.victimName, null);
  assert.equal(kansasCity.city, "Kansas City");
  assert.equal(kansasCity.stateCode, "MO");
  assert.equal(kansasCity.occurredOn, "2026-11-10");
  assert.equal(kansasCity.lighting, "daylight");
  assert.match(kansasCity.summary, /Kia Sorento/);
  assert.match(kansasCity.summary, /87th Street/);
  assert.match(kansasCity.context, /place point/);
  assert.equal(kansasCity.latitude, 39.10011);
  assert.equal(kansasCity.longitude, -94.57814);

  const armour = byId.get("news-65a0e23b12925d0a");
  assert.equal(armour.reviewStatus, "pending");
  assert.equal(armour.verified, false);
  assert.equal(armour.outcome, "serious_injury");
  assert.equal(armour.city, "Kansas City");
  assert.equal(armour.stateCode, "MO");
  assert.equal(armour.occurredOn, "2026-11-10");
  assert.equal(armour.vehicleType, "car");
  assert.match(
    armour.context,
    /No police statement or news article has confirmed that the person was riding a bicycle/,
  );
  assert.match(armour.summary, /Gillham Road/);
  assert.equal(armour.latitude, 39.06362);
  assert.equal(armour.longitude, -94.581);

  const greenville = byId.get("news-9eedd744576a73d3");
  assert.equal(greenville.reviewStatus, "published");
  assert.equal(greenville.verified, true);
  assert.equal(greenville.outcome, "serious_injury");
  assert.equal(greenville.severity, "high");
  assert.equal(greenville.victimName, null);
  assert.equal(greenville.victimAgeBand, "10\u201319");
  assert.equal(greenville.vehicleType, "truck");
  assert.equal(greenville.city, "Greenville");
  assert.equal(greenville.stateCode, "NC");
  assert.equal(greenville.occurredOn, "2026-11-09");
  assert.equal(greenville.lighting, "daylight");
  assert.match(greenville.summary, /J\.H\. Rose High School/);
  assert.match(greenville.summary, /Arlington Boulevard/);
  assert.match(greenville.context, /already filed/);
  assert.equal(greenville.latitude, 35.59365);
  assert.equal(greenville.longitude, -77.38611);

  const clarksville = byId.get("news-5be474f57d250136");
  assert.equal(clarksville.reviewStatus, "published");
  assert.equal(clarksville.verified, true);
  assert.equal(clarksville.outcome, "serious_injury");
  assert.equal(clarksville.severity, "high");
  assert.equal(clarksville.victimName, null);
  assert.equal(clarksville.victimAgeBand, "60\u201369");
  assert.equal(clarksville.vehicleType, "car");
  assert.equal(clarksville.city, "Clarksville");
  assert.equal(clarksville.stateCode, "TN");
  assert.equal(clarksville.occurredOn, "2026-10-09");
  assert.equal(clarksville.lighting, "dark");
  assert.match(clarksville.summary, /2760 Trenton Road/);
  assert.match(clarksville.context, /early Wednesday/);
  assert.equal(clarksville.latitude, 36.58934);
  assert.equal(clarksville.longitude, -87.31333);

  const katy = byId.get("news-617218ca3f9e390e");
  assert.equal(katy.victimName, "Chinwe Keisha Egbo");
  assert.equal(
    news.filter((row) => row.victimName === "Chinwe Keisha Egbo" || /4100 block of Pitts Road/.test(row.summary))
      .length,
    1,
  );

  const published = [phenix, leesburg, kansasCity, greenville, clarksville];
  assert.equal(published.filter((row) => row.outcome === "killed").length, 2);
  assert.equal(published.filter((row) => row.outcome === "serious_injury").length, 3);
  assert.ok(published.every((row) => row.verified === true && row.reviewStatus === "published"));
  assert.ok(published.every((row) => row.ingestSource === "news" && row.datePrecision === "day"));
  assert.equal(armour.reviewStatus, "pending");

  const ids = new Set(news.map((row) => row.id));
  assert.equal(ids.size, news.length);
  const prepared = prepareImports(root);
  for (const row of [...published, armour]) {
    assert.ok(
      prepared.news.some((item) => item.id === row.id),
      row.id,
    );
  }
});

test("Nov 12 2026 desk sweep publishes confirmed crashes and queues the rest", () => {
  const news = JSON.parse(readFileSync(join(root, "data/crash-imports/news.json"), "utf8"));
  const byId = new Map(news.map((row) => [row.id, row]));

  const taylorsville = byId.get("news-a82be10c1098a0e0");
  assert.equal(taylorsville.reviewStatus, "published");
  assert.equal(taylorsville.verified, true);
  assert.equal(taylorsville.outcome, "serious_injury");
  assert.equal(taylorsville.severity, "critical");
  assert.equal(taylorsville.fatalities, 0);
  assert.equal(taylorsville.injured, 1);
  assert.equal(taylorsville.victimName, null);
  assert.equal(taylorsville.victimAgeBand, "10\u201319");
  assert.equal(taylorsville.crashType, "intersection");
  assert.equal(taylorsville.driverStatus, "at_scene");
  assert.equal(taylorsville.vehicleType, "SUV");
  assert.equal(taylorsville.city, "Taylorsville");
  assert.equal(taylorsville.stateCode, "UT");
  assert.equal(taylorsville.occurredOn, "2026-11-11");
  assert.equal(taylorsville.lighting, "daylight");
  assert.match(taylorsville.summary, /4200 South/);
  assert.match(taylorsville.summary, /Primary Children's Hospital/);
  assert.match(taylorsville.context, /West Valley City/);
  assert.equal(taylorsville.latitude, 40.67973);
  assert.equal(taylorsville.longitude, -111.93825);
  assert.ok(news[0].occurredOn >= taylorsville.occurredOn);

  const orion = byId.get("news-28ffd3360b1a22a3");
  assert.equal(orion.reviewStatus, "pending");
  assert.equal(orion.verified, false);
  assert.equal(orion.outcome, "serious_injury");
  assert.equal(orion.severity, "critical");
  assert.equal(orion.city, "Orion Township");
  assert.equal(orion.stateCode, "MI");
  assert.equal(orion.occurredOn, "2026-11-11");
  assert.equal(orion.vehicleType, null);
  assert.match(orion.context, /No motor vehicle was involved/);
  assert.match(orion.summary, /sewer pipe/);
  assert.match(orion.summary, /Axford Street/);
  assert.equal(orion.latitude, 42.78951);
  assert.equal(orion.longitude, -83.24582);

  const pittsfield = byId.get("news-fbad610c64661f59");
  assert.equal(pittsfield.reviewStatus, "published");
  assert.equal(pittsfield.verified, true);
  assert.equal(pittsfield.outcome, "killed");
  assert.equal(pittsfield.severity, "critical");
  assert.equal(pittsfield.fatalities, 1);
  assert.equal(pittsfield.injured, 0);
  assert.equal(pittsfield.victimName, "Jeffrey Cookson");
  assert.equal(pittsfield.victimAgeBand, "50\u201359");
  assert.equal(pittsfield.crashType, "hit-and-run");
  assert.equal(pittsfield.driverStatus, "fled");
  assert.equal(pittsfield.vehicleType, "car");
  assert.equal(pittsfield.city, "Pittsfield");
  assert.equal(pittsfield.stateCode, "ME");
  assert.equal(pittsfield.occurredOn, "2026-11-10");
  assert.equal(pittsfield.lighting, "dusk");
  assert.match(pittsfield.summary, /Peltoma Avenue/);
  assert.match(pittsfield.summary, /4:30/);
  assert.match(pittsfield.summary, /Jetta/);
  assert.match(pittsfield.context, /496 Peltoma Avenue/);
  assert.equal(pittsfield.latitude, 44.77238);
  assert.equal(pittsfield.longitude, -69.36434);
  assert.equal(pittsfield.sourceName, "WMTW");

  const marlboro = byId.get("news-0d9de49fbde0faf2");
  assert.equal(marlboro.reviewStatus, "pending");
  assert.equal(marlboro.verified, false);
  assert.equal(marlboro.outcome, "serious_injury");
  assert.equal(marlboro.city, "Marlboro Township");
  assert.equal(marlboro.stateCode, "OH");
  assert.equal(marlboro.occurredOn, "2026-11-10");
  assert.equal(marlboro.vehicleType, "SUV");
  assert.equal(marlboro.helmet, "worn");
  assert.match(marlboro.context, /Not confirmed as a bicycle/);
  assert.match(marlboro.summary, /Smith Kramer Street/);
  assert.equal(marlboro.latitude, 40.93891);
  assert.equal(marlboro.longitude, -81.29146);

  const bolton = byId.get("news-5771f1a16a0467e4");
  assert.equal(bolton.reviewStatus, "pending");
  assert.equal(bolton.verified, false);
  assert.equal(bolton.outcome, "serious_injury");
  assert.equal(bolton.city, "Bolton");
  assert.equal(bolton.stateCode, "MS");
  assert.equal(bolton.occurredOn, "2026-11-07");
  assert.equal(bolton.vehicleType, null);
  assert.equal(bolton.latitude, null);
  assert.equal(bolton.longitude, null);
  assert.match(bolton.context, /injury is not stated/i);
  assert.match(bolton.summary, /Champion Hill Road/);

  const plano = byId.get("news-8db0ee7e95ed31fa");
  assert.equal(plano.reviewStatus, "published");
  assert.equal(plano.verified, true);
  assert.equal(plano.outcome, "serious_injury");
  assert.equal(plano.severity, "high");
  assert.equal(plano.crashType, "hit-and-run");
  assert.equal(plano.driverStatus, "fled");
  assert.equal(plano.victimName, null);
  assert.equal(plano.city, "Plano");
  assert.equal(plano.stateCode, "TX");
  assert.equal(plano.occurredOn, "2026-10-06");
  assert.equal(plano.lighting, "dark");
  assert.match(plano.summary, /East Park Boulevard/);
  assert.match(plano.summary, /N Avenue/);
  assert.match(plano.summary, /Oct\. 6/);
  assert.equal(plano.latitude, 33.03132);
  assert.equal(plano.longitude, -96.69492);

  const elkGrove = byId.get("news-6ee8392311b134eb");
  assert.equal(elkGrove.outcome, "serious_injury");
  assert.equal(elkGrove.fatalities, 0);
  assert.equal(elkGrove.injured, 1);
  assert.equal(elkGrove.reviewStatus, "published");
  assert.equal(elkGrove.city, "Elk Grove");
  assert.equal(elkGrove.occurredOn, "2026-11-05");

  const published = [taylorsville, pittsfield, plano];
  assert.equal(published.filter((row) => row.outcome === "killed").length, 1);
  assert.equal(published.filter((row) => row.outcome === "serious_injury").length, 2);
  assert.ok(published.every((row) => row.verified === true && row.reviewStatus === "published"));
  assert.ok(published.every((row) => row.ingestSource === "news" && row.datePrecision === "day"));
  assert.equal(orion.reviewStatus, "pending");
  assert.equal(marlboro.reviewStatus, "pending");
  assert.equal(bolton.reviewStatus, "pending");
  assert.equal(
    news.filter((row) => row.victimName === "Jeffrey Cookson" || /Peltoma Avenue/.test(row.summary)).length,
    1,
  );
  assert.equal(
    news.filter((row) => row.city === "Bolton" && row.occurredOn === "2026-11-07").length,
    1,
  );

  const ids = new Set(news.map((row) => row.id));
  assert.equal(ids.size, news.length);
  const prepared = prepareImports(root);
  for (const row of [...published, orion, marlboro, bolton]) {
    assert.ok(
      prepared.news.some((item) => item.id === row.id),
      row.id,
    );
  }
});

test("Nov 13 2026 desk sweep publishes confirmed crashes and queues the rest", () => {
  const news = JSON.parse(readFileSync(join(root, "data/crash-imports/news.json"), "utf8"));
  const byId = new Map(news.map((row) => [row.id, row]));

  const miami = byId.get("news-4d007bdf5b89b7ef");
  assert.equal(miami.reviewStatus, "published");
  assert.equal(miami.verified, true);
  assert.equal(miami.outcome, "killed");
  assert.equal(miami.severity, "critical");
  assert.equal(miami.fatalities, 1);
  assert.equal(miami.injured, 0);
  assert.equal(miami.victimName, null);
  assert.equal(miami.crashType, "intersection");
  assert.equal(miami.driverStatus, "at_scene");
  assert.equal(miami.vehicleType, "car");
  assert.equal(miami.city, "Miami Gardens");
  assert.equal(miami.stateCode, "FL");
  assert.equal(miami.occurredOn, "2026-11-12");
  assert.equal(miami.lighting, "dark");
  assert.match(miami.summary, /215th Street/);
  assert.match(miami.summary, /San Simeon Way/);
  assert.match(miami.summary, /5:46/);
  assert.match(miami.context, /Miami Gardens/);
  assert.equal(miami.latitude, 25.97315);
  assert.equal(miami.longitude, -80.19445);

  const dallas = byId.get("news-7ecd962c7303e87f");
  assert.equal(dallas.reviewStatus, "published");
  assert.equal(dallas.verified, true);
  assert.equal(dallas.outcome, "killed");
  assert.equal(dallas.fatalities, 1);
  assert.equal(dallas.injured, 0);
  assert.equal(dallas.victimName, null);
  assert.equal(dallas.crashType, "intersection");
  assert.equal(dallas.driverStatus, "at_scene");
  assert.equal(dallas.vehicleType, "pickup");
  assert.equal(dallas.city, "Dallas");
  assert.equal(dallas.stateCode, "TX");
  assert.equal(dallas.occurredOn, "2026-11-11");
  assert.equal(dallas.lighting, "dark");
  assert.match(dallas.summary, /Marsalis/);
  assert.match(dallas.summary, /9:12/);
  assert.equal(dallas.latitude, 32.75878);
  assert.equal(dallas.longitude, -96.81566);
  assert.equal(dallas.sourceName, "FOX 4");

  const westPalm = byId.get("news-1a9196140f7ee720");
  assert.equal(westPalm.reviewStatus, "published");
  assert.equal(westPalm.verified, true);
  assert.equal(westPalm.outcome, "serious_injury");
  assert.equal(westPalm.severity, "critical");
  assert.equal(westPalm.fatalities, 0);
  assert.equal(westPalm.injured, 1);
  assert.equal(westPalm.victimName, null);
  assert.equal(westPalm.vehicleType, null);
  assert.equal(westPalm.driverStatus, "at_scene");
  assert.equal(westPalm.city, "West Palm Beach");
  assert.equal(westPalm.stateCode, "FL");
  assert.equal(westPalm.occurredOn, "2026-11-11");
  assert.equal(westPalm.lighting, "dusk");
  assert.match(westPalm.summary, /Madeira Court/);
  assert.match(westPalm.summary, /St\. Mary's/);
  assert.equal(westPalm.latitude, 26.7244);
  assert.equal(westPalm.longitude, -80.05484);

  const hutchinson = byId.get("news-3877274ba08b983b");
  assert.equal(hutchinson.reviewStatus, "published");
  assert.equal(hutchinson.verified, true);
  assert.equal(hutchinson.outcome, "serious_injury");
  assert.equal(hutchinson.severity, "critical");
  assert.equal(hutchinson.victimName, "Mark Francis Pedretti");
  assert.equal(hutchinson.victimAgeBand, "60\u201369");
  assert.equal(hutchinson.vehicleType, "SUV");
  assert.equal(hutchinson.helmet, "no");
  assert.equal(hutchinson.city, "Hutchinson");
  assert.equal(hutchinson.stateCode, "MN");
  assert.equal(hutchinson.occurredOn, "2026-11-11");
  assert.equal(hutchinson.lighting, "daylight");
  assert.match(hutchinson.summary, /School Road/);
  assert.equal(hutchinson.latitude, 44.89357);
  assert.equal(hutchinson.longitude, -94.39526);

  const fortRecovery = byId.get("news-6a375977f138185f");
  assert.equal(fortRecovery.reviewStatus, "pending");
  assert.equal(fortRecovery.verified, false);
  assert.equal(fortRecovery.outcome, "killed");
  assert.equal(fortRecovery.victimName, "Charles Binegar Jr.");
  assert.equal(fortRecovery.city, "Fort Recovery");
  assert.equal(fortRecovery.stateCode, "OH");
  assert.equal(fortRecovery.occurredOn, "2026-11-11");
  assert.equal(fortRecovery.vehicleType, null);
  assert.match(fortRecovery.context, /No motor vehicle was involved/);
  assert.match(fortRecovery.summary, /utility box/);
  assert.equal(fortRecovery.latitude, 40.41324);
  assert.equal(fortRecovery.longitude, -84.78141);

  const redRock = byId.get("news-8fcf092059916991");
  assert.equal(redRock.reviewStatus, "pending");
  assert.equal(redRock.verified, false);
  assert.equal(redRock.outcome, "serious_injury");
  assert.equal(redRock.city, "Red Rock Canyon");
  assert.equal(redRock.stateCode, "NV");
  assert.equal(redRock.occurredOn, "2026-11-12");
  assert.equal(redRock.vehicleType, null);
  assert.equal(redRock.latitude, null);
  assert.equal(redRock.longitude, null);
  assert.match(redRock.context, /No motor vehicle was involved/);
  assert.match(redRock.summary, /Scenic Loop/);

  const hillcrest = byId.get("news-36f6d1827d0eb368");
  assert.equal(hillcrest.reviewStatus, "pending");
  assert.equal(hillcrest.verified, false);
  assert.equal(hillcrest.city, "Hillcrest");
  assert.equal(hillcrest.stateCode, "NY");
  assert.equal(hillcrest.datePrecision, "published");
  assert.match(hillcrest.context, /injury is not stated/i);
  assert.match(hillcrest.summary, /West Eckerson Road/);
  assert.equal(hillcrest.latitude, 41.12777);
  assert.equal(hillcrest.longitude, -74.04112);

  const orion = byId.get("news-28ffd3360b1a22a3");
  assert.equal(orion.reviewStatus, "pending");
  assert.equal(orion.victimName, "John Reilly");
  assert.equal(orion.helmet, "worn");
  assert.match(orion.context, /No motor vehicle was involved/);

  const published = [miami, dallas, westPalm, hutchinson];
  assert.equal(published.filter((row) => row.outcome === "killed").length, 2);
  assert.equal(published.filter((row) => row.outcome === "serious_injury").length, 2);
  assert.ok(published.every((row) => row.verified === true && row.reviewStatus === "published"));
  assert.ok(published.every((row) => row.ingestSource === "news" && row.datePrecision === "day"));
  assert.equal(fortRecovery.reviewStatus, "pending");
  assert.equal(redRock.reviewStatus, "pending");
  assert.equal(hillcrest.reviewStatus, "pending");
  assert.equal(
    news.filter((row) => row.victimName === "Mark Francis Pedretti" || /School Road in Hutchinson/.test(row.summary))
      .length,
    1,
  );
  assert.equal(
    news.filter((row) => row.city === "Dallas" && row.occurredOn === "2026-11-11").length,
    1,
  );
  assert.equal(
    news.filter((row) => row.city === "West Palm Beach" && row.occurredOn === "2026-11-11").length,
    1,
  );

  const ids = new Set(news.map((row) => row.id));
  assert.equal(ids.size, news.length);
  const prepared = prepareImports(root);
  for (const row of [...published, fortRecovery, redRock, hillcrest]) {
    assert.ok(
      prepared.news.some((item) => item.id === row.id),
      row.id,
    );
  }
});

test("Nov 14 2026 desk sweep publishes confirmed crashes and queues the rest", () => {
  const news = JSON.parse(readFileSync(join(root, "data/crash-imports/news.json"), "utf8"));
  const byId = new Map(news.map((row) => [row.id, row]));

  const hanover = byId.get("news-5d15589fc988fc05");
  assert.equal(hanover.reviewStatus, "published");
  assert.equal(hanover.verified, true);
  assert.equal(hanover.outcome, "serious_injury");
  assert.equal(hanover.severity, "high");
  assert.equal(hanover.fatalities, 0);
  assert.equal(hanover.injured, 1);
  assert.equal(hanover.victimName, null);
  assert.equal(hanover.crashType, "hit-and-run");
  assert.equal(hanover.driverStatus, "fled");
  assert.equal(hanover.vehicleType, "SUV");
  assert.equal(hanover.city, "Hanover Township");
  assert.equal(hanover.stateCode, "PA");
  assert.equal(hanover.occurredOn, "2026-11-13");
  assert.equal(hanover.lighting, "dark");
  assert.match(hanover.summary, /Oxford Street/);
  assert.match(hanover.summary, /5:40/);
  assert.match(hanover.summary, /Nissan Rogue/);
  assert.match(hanover.context, /Luzerne|Lee Park/);
  assert.equal(hanover.latitude, 41.23242);
  assert.equal(hanover.longitude, -75.91771);
  assert.ok(news[0].occurredOn >= hanover.occurredOn);

  const osage = byId.get("news-ca26afb67b64c393");
  assert.equal(osage.reviewStatus, "published");
  assert.equal(osage.verified, true);
  assert.equal(osage.outcome, "serious_injury");
  assert.equal(osage.severity, "high");
  assert.equal(osage.fatalities, 0);
  assert.equal(osage.injured, 1);
  assert.equal(osage.victimName, null);
  assert.equal(osage.victimAgeBand, "10\u201319");
  assert.equal(osage.crashType, "other");
  assert.equal(osage.driverStatus, "at_scene");
  assert.equal(osage.vehicleType, "pickup");
  assert.equal(osage.city, "Osage Township");
  assert.equal(osage.stateCode, "MN");
  assert.equal(osage.occurredOn, "2026-11-12");
  assert.equal(osage.lighting, "daylight");
  assert.match(osage.summary, /County Road 123/);
  assert.match(osage.summary, /4:07/);
  assert.match(osage.summary, /Kevin Beyer/);
  assert.match(osage.context, /Highway 34/);
  assert.equal(osage.latitude, 46.90582);
  assert.equal(osage.longitude, -95.24755);
  assert.equal(osage.sourceName, "Detroit Lakes Tribune");

  const germantown = byId.get("news-5c4e1386ba1b6f79");
  assert.equal(germantown.reviewStatus, "published");
  assert.equal(germantown.verified, true);
  assert.equal(germantown.outcome, "killed");
  assert.equal(germantown.severity, "critical");
  assert.equal(germantown.fatalities, 1);
  assert.equal(germantown.injured, 0);
  assert.equal(germantown.victimName, "Dysheir M. McFadden");
  assert.equal(germantown.victimAgeBand, "20\u201329");
  assert.equal(germantown.crashType, "hit-and-run");
  assert.equal(germantown.driverStatus, "fled");
  assert.equal(germantown.vehicleType, "car");
  assert.equal(germantown.locationName, "Germantown, Philadelphia, PA");
  assert.equal(germantown.locationPrecision, "exact");
  assert.equal(germantown.city, "Philadelphia");
  assert.equal(germantown.stateCode, "PA");
  assert.equal(germantown.occurredOn, "2026-11-13");
  assert.equal(germantown.lighting, "dark");
  assert.match(germantown.summary, /Chelten Avenue/);
  assert.match(germantown.summary, /1:02/);
  assert.match(germantown.context, /Sources disagree on the device/);
  assert.match(germantown.context, /police and NBC10 say electric dirt bike/);
  assert.match(germantown.context, /6abc says illegal electric motorcycle/);
  assert.match(germantown.context, /FOX 29 says e-bike/);
  assert.equal(germantown.latitude, 40.03838);
  assert.equal(germantown.longitude, -75.17213);
  assert.equal(
    googleMapsSearchUrl({
      latitude: germantown.latitude,
      longitude: germantown.longitude,
      locationName: germantown.locationName,
      city: germantown.city,
      state: germantown.state,
    }),
    "https://www.google.com/maps/search/?api=1&query=40.03838,-75.17213",
  );

  const northAdams = byId.get("news-729dacd58b702e44");
  assert.equal(northAdams.reviewStatus, "pending");
  assert.equal(northAdams.verified, false);
  assert.equal(northAdams.outcome, "serious_injury");
  assert.equal(northAdams.severity, "high");
  assert.equal(northAdams.victimName, null);
  assert.equal(northAdams.vehicleType, "car");
  assert.equal(northAdams.city, "North Adams");
  assert.equal(northAdams.stateCode, "MA");
  assert.equal(northAdams.occurredOn, "2026-11-12");
  assert.equal(northAdams.lighting, "dark");
  assert.equal(northAdams.latitude, null);
  assert.equal(northAdams.longitude, null);
  assert.match(northAdams.context, /No moving motor vehicle was involved/);
  assert.match(northAdams.summary, /parked car/);
  assert.match(northAdams.summary, /State Street/);

  const published = [hanover, osage, germantown];
  assert.equal(published.filter((row) => row.outcome === "killed").length, 1);
  assert.equal(published.filter((row) => row.outcome === "serious_injury").length, 2);
  assert.ok(published.every((row) => row.verified === true && row.reviewStatus === "published"));
  assert.ok(published.every((row) => row.ingestSource === "news" && row.datePrecision === "day"));
  assert.equal(northAdams.reviewStatus, "pending");
  assert.equal(
    news.filter((row) => row.victimName === "Dysheir M. McFadden" || /East Chelten Avenue near Baynton/.test(row.summary))
      .length,
    1,
  );
  assert.equal(
    news.filter((row) => row.city === "Hanover Township" && row.occurredOn === "2026-11-13").length,
    1,
  );
  assert.equal(
    news.filter((row) => row.city === "Osage Township" && row.occurredOn === "2026-11-12").length,
    1,
  );
  assert.equal(
    news.filter((row) => /220th/.test(row.summary) && row.city === "Torrance").length,
    0,
  );

  const ids = new Set(news.map((row) => row.id));
  assert.equal(ids.size, news.length);
  const prepared = prepareImports(root);
  for (const row of [...published, germantown, northAdams]) {
    assert.ok(
      prepared.news.some((item) => item.id === row.id),
      row.id,
    );
  }
});

test("Nov 15 2026 desk sweep publishes the Mobile hit-and-run and the New Brunswick e-bike crash", () => {
  const news = JSON.parse(readFileSync(join(root, "data/crash-imports/news.json"), "utf8"));
  const byId = new Map(news.map((row) => [row.id, row]));

  const ensor = byId.get("news-79b876e0b806582a");
  assert.equal(ensor.reviewStatus, "published");
  assert.equal(ensor.verified, true);
  assert.equal(ensor.ingestSource, "news");
  assert.equal(ensor.outcome, "killed");
  assert.equal(ensor.severity, "critical");
  assert.equal(ensor.fatalities, 1);
  assert.equal(ensor.injured, 0);
  assert.equal(ensor.victimName, "John Ensor Jr.");
  assert.equal(ensor.crashType, "hit-and-run");
  assert.equal(ensor.driverStatus, "fled");
  assert.equal(ensor.vehicleType, "GMC Yukon towing a boat");
  assert.equal(ensor.city, "Mobile");
  assert.equal(ensor.stateCode, "AL");
  assert.equal(ensor.region, "South");
  assert.equal(ensor.occurredOn, "2026-10-27");
  assert.equal(ensor.datePrecision, "day");
  assert.equal(ensor.lighting, "dark");
  assert.equal(ensor.roadwayType, "Old Pascagoula Road");
  assert.match(ensor.summary, /Horse Shoe Lane/);
  assert.match(ensor.summary, /from behind/);
  assert.match(ensor.summary, /west/);
  assert.match(ensor.summary, /convenience store/);
  assert.match(ensor.summary, /Oct\. 28/);
  assert.match(ensor.summary, /impounded/);
  assert.match(ensor.context, /first reported Nov\. 13 from a crash report/);
  assert.match(ensor.context, /Lighting was dark/);
  assert.match(ensor.context, /South Alabama News/);
  assert.match(ensor.context, /no charges/);
  assert.equal(ensor.latitude, 30.56099);
  assert.equal(ensor.longitude, -88.22108);
  assert.equal(ensor.locationPrecision, "town");
  assert.equal(ensor.sourceName, "FOX10 News");
  assert.equal(
    ensor.sourceUrl,
    "https://www.fox10tv.com/2026/11/13/alea-driver-hit-killed-bicyclist-old-pascagoula-road-then-left-scene/",
  );
  assert.ok(news[0].occurredOn >= "2026-11-13");

  const southerland = byId.get("news-aca788ed0c5a84c7");
  assert.equal(southerland.reviewStatus, "published");
  assert.equal(southerland.verified, true);
  assert.equal(southerland.ingestSource, "news");
  assert.equal(southerland.outcome, "killed");
  assert.equal(southerland.severity, "critical");
  assert.equal(southerland.fatalities, 1);
  assert.equal(southerland.injured, 0);
  assert.equal(southerland.victimName, "Gary Southerland");
  assert.equal(southerland.victimAgeBand, "50\u201359");
  assert.equal(southerland.crashType, "other");
  assert.equal(southerland.driverStatus, "at_scene");
  assert.equal(southerland.vehicleType, "car");
  assert.equal(southerland.city, "New Brunswick");
  assert.equal(southerland.stateCode, "NJ");
  assert.equal(southerland.region, "Northeast");
  assert.equal(southerland.occurredOn, "2026-11-08");
  assert.equal(southerland.datePrecision, "day");
  assert.equal(southerland.lighting, "dark");
  assert.equal(southerland.roadwayType, "Jersey Avenue");
  assert.match(southerland.summary, /200 block/);
  assert.match(southerland.summary, /7:17/);
  assert.match(southerland.summary, /electric bicycle/);
  assert.match(southerland.summary, /stopped/);
  assert.match(southerland.summary, /No charges/);
  assert.match(southerland.context, /motor vehicle was involved/);
  assert.equal(southerland.latitude, 40.48743);
  assert.equal(southerland.longitude, -74.45873);
  assert.equal(southerland.locationPrecision, "town");
  assert.equal(southerland.sourceName, "NJ.com");
  assert.equal(
    southerland.sourceUrl,
    "https://www.nj.com/middlesex/2026/11/a-man-died-after-falling-off-an-e-bike-and-being-hit-by-a-car-police-say.html",
  );

  const published = [ensor, southerland];
  assert.equal(published.filter((row) => row.outcome === "killed").length, 2);
  assert.ok(published.every((row) => row.verified === true && row.reviewStatus === "published"));
  assert.ok(published.every((row) => row.ingestSource === "news" && row.datePrecision === "day"));
  assert.equal(
    news.filter((row) => row.victimName === "John Ensor Jr." || /Old Pascagoula Road/.test(row.summary))
      .length,
    1,
  );
  assert.equal(
    news.filter((row) => row.victimName === "Gary Southerland" || /200 block of Jersey Avenue/.test(row.summary))
      .length,
    1,
  );

  const ids = new Set(news.map((row) => row.id));
  assert.equal(ids.size, news.length);
  const prepared = prepareImports(root);
  for (const row of published) {
    assert.ok(
      prepared.news.some((item) => item.id === row.id),
      row.id,
    );
  }
});

test("Nov 16 2026 desk sweep publishes the Chico death and the Commerce injury and queues Coral Springs", () => {
  const news = JSON.parse(readFileSync(join(root, "data/crash-imports/news.json"), "utf8"));
  const byId = new Map(news.map((row) => [row.id, row]));

  const commerce = byId.get("news-bc32d33e7a38cd84");
  assert.equal(commerce.reviewStatus, "published");
  assert.equal(commerce.verified, true);
  assert.equal(commerce.ingestSource, "news");
  assert.equal(commerce.outcome, "serious_injury");
  assert.equal(commerce.severity, "critical");
  assert.equal(commerce.fatalities, 0);
  assert.equal(commerce.injured, 1);
  assert.equal(commerce.victimName, null);
  assert.equal(commerce.crashType, "intersection");
  assert.equal(commerce.driverStatus, "unknown");
  assert.equal(commerce.vehicleType, null);
  assert.equal(commerce.city, "Commerce");
  assert.equal(commerce.stateCode, "CA");
  assert.equal(commerce.region, "West");
  assert.equal(commerce.occurredOn, "2026-11-15");
  assert.equal(commerce.datePrecision, "day");
  assert.equal(commerce.lighting, "daylight");
  assert.equal(commerce.roadwayType, "Telegraph Road");
  assert.match(commerce.summary, /12:20/);
  assert.match(commerce.summary, /Atlantic Boulevard/);
  assert.match(commerce.summary, /traumatic injuries/);
  assert.match(commerce.summary, /Los Angeles General/);
  assert.match(commerce.context, /not a surveyed crash coordinate/);
  assert.equal(commerce.latitude, 34.00793);
  assert.equal(commerce.longitude, -118.15667);
  assert.equal(commerce.locationPrecision, "town");
  assert.equal(commerce.sourceName, "MyNewsLA");
  assert.equal(
    commerce.sourceUrl,
    "https://mynewsla.com/business/2026/11/15/bicyclist-suffers-traumatic-injuries-in-crash-with-vehicle-in-commerce/",
  );
  assert.ok(news.some((row) => row.id === commerce.id));

  const chico = byId.get("news-3dd23b784e9c2124");
  assert.equal(chico.reviewStatus, "published");
  assert.equal(chico.verified, true);
  assert.equal(chico.ingestSource, "news");
  assert.equal(chico.outcome, "killed");
  assert.equal(chico.severity, "critical");
  assert.equal(chico.fatalities, 1);
  assert.equal(chico.injured, 0);
  assert.equal(chico.victimName, null);
  assert.equal(chico.crashType, "other");
  assert.equal(chico.driverStatus, "unknown");
  assert.equal(chico.vehicleType, "car");
  assert.equal(chico.city, "Chico");
  assert.equal(chico.stateCode, "CA");
  assert.equal(chico.region, "West");
  assert.equal(chico.occurredOn, "2026-11-14");
  assert.equal(chico.datePrecision, "day");
  assert.equal(chico.lighting, "dark");
  assert.equal(chico.roadwayType, "Nord Avenue");
  assert.match(chico.summary, /900 block of Nord Avenue/);
  assert.match(chico.summary, /8:33/);
  assert.match(chico.summary, /Major Accident Investigation Team/);
  assert.match(chico.summary, /897-4974/);
  assert.match(chico.context, /not a surveyed crash coordinate/);
  assert.match(chico.context, /Pacific Attorney Group/);
  assert.equal(chico.latitude, 39.73052);
  assert.equal(chico.longitude, -121.85757);
  assert.equal(chico.locationPrecision, "town");
  assert.equal(chico.sourceName, "Action News Now");
  assert.equal(
    chico.sourceUrl,
    "https://www.actionnewsnow.com/news/butte-county/chico-cyclist-dies-after-being-hit-on-nord-avenue/article_80460dc6-c5ea-4e01-9aec-f0627abb304b.html",
  );

  const coral = byId.get("news-d8890629e2b81dfa");
  assert.equal(coral.reviewStatus, "pending");
  assert.equal(coral.verified, false);
  assert.equal(coral.ingestSource, "news");
  assert.equal(coral.outcome, "serious_injury");
  assert.equal(coral.severity, "moderate");
  assert.equal(coral.fatalities, 0);
  assert.equal(coral.injured, 1);
  assert.equal(coral.victimName, null);
  assert.equal(coral.crashType, "hit-and-run");
  assert.equal(coral.driverStatus, "charged");
  assert.equal(coral.vehicleType, "SUV");
  assert.equal(coral.city, "Coral Springs");
  assert.equal(coral.stateCode, "FL");
  assert.equal(coral.region, "South");
  assert.equal(coral.occurredOn, "2026-11-12");
  assert.equal(coral.datePrecision, "approximate");
  assert.equal(coral.lighting, null);
  assert.equal(coral.roadwayType, "Northwest 39th Street");
  assert.match(coral.summary, /Florencio Anton Quijada Brito/);
  assert.match(coral.summary, /aggravated battery/);
  assert.match(coral.summary, /sidewalk/);
  assert.match(coral.summary, /Broward Health Coral Springs/);
  assert.match(coral.context, /exact crash date is not stated/i);
  assert.match(coral.context, /intentional assault/i);
  assert.match(coral.context, /not a surveyed crash coordinate/);
  assert.equal(coral.latitude, 26.27864);
  assert.equal(coral.longitude, -80.2796);
  assert.equal(coral.locationPrecision, "town");
  assert.equal(coral.sourceName, "Coral Springs Talk");
  assert.equal(
    coral.sourceUrl,
    "https://coralspringstalk.com/coral-springs-hit-and-run-e-bike-rider-neighborhood-chase-63202",
  );

  const published = [commerce, chico];
  assert.equal(published.filter((row) => row.outcome === "killed").length, 1);
  assert.equal(published.filter((row) => row.outcome === "serious_injury").length, 1);
  assert.ok(published.every((row) => row.verified === true && row.reviewStatus === "published"));
  assert.ok(published.every((row) => row.ingestSource === "news" && row.datePrecision === "day"));
  assert.equal(coral.reviewStatus, "pending");
  assert.equal(
    news.filter((row) => row.city === "Chico" && row.occurredOn === "2026-11-14").length,
    1,
  );
  assert.equal(
    news.filter((row) => row.city === "Commerce" && row.occurredOn === "2026-11-15").length,
    1,
  );
  assert.equal(
    news.filter((row) => /Florencio Anton Quijada Brito/.test(row.summary)).length,
    1,
  );
  assert.equal(
    news.filter((row) => /900 block of Nord Avenue/.test(row.summary)).length,
    1,
  );

  const ids = new Set(news.map((row) => row.id));
  assert.equal(ids.size, news.length);
  const prepared = prepareImports(root);
  for (const row of [...published, coral]) {
    assert.ok(
      prepared.news.some((item) => item.id === row.id),
      row.id,
    );
  }
});

test("Nov 17 2026 desk sweep publishes six injuries and queues the Riverside extrication", () => {
  const news = JSON.parse(readFileSync(join(root, "data/crash-imports/news.json"), "utf8"));
  const byId = new Map(news.map((row) => [row.id, row]));

  const fallsChurch = byId.get("news-e38d3d84143dcb10");
  assert.equal(fallsChurch.reviewStatus, "published");
  assert.equal(fallsChurch.verified, true);
  assert.equal(fallsChurch.ingestSource, "news");
  assert.equal(fallsChurch.outcome, "killed");
  assert.equal(fallsChurch.severity, "critical");
  assert.equal(fallsChurch.fatalities, 1);
  assert.equal(fallsChurch.injured, 0);
  assert.equal(fallsChurch.victimName, "Nicholas Filbert");
  assert.equal(fallsChurch.crashType, "intersection");
  assert.equal(fallsChurch.driverStatus, "at_scene");
  assert.equal(fallsChurch.vehicleType, "car");
  assert.equal(fallsChurch.helmet, "no");
  assert.equal(fallsChurch.city, "East Falls Church");
  assert.equal(fallsChurch.stateCode, "VA");
  assert.equal(fallsChurch.region, "South");
  assert.equal(fallsChurch.occurredOn, "2026-11-16");
  assert.equal(fallsChurch.datePrecision, "day");
  assert.equal(fallsChurch.lighting, "dark");
  assert.equal(fallsChurch.roadwayType, "Washington Boulevard");
  assert.match(fallsChurch.summary, /8 p\.m\./);
  assert.match(fallsChurch.summary, /Langston Boulevard/);
  assert.match(fallsChurch.summary, /against the light/);
  assert.match(fallsChurch.context, /not a surveyed crash coordinate/);
  assert.equal(fallsChurch.latitude, 38.88824);
  assert.equal(fallsChurch.longitude, -77.16105);
  assert.equal(fallsChurch.locationPrecision, "town");
  assert.equal(fallsChurch.sourceName, "ARLnow");
  assert.equal(
    fallsChurch.sourceUrl,
    "https://www.arlnow.com/2026/11/16/breaking-bicyclist-struck-critically-injured-in-east-falls-church/",
  );
  assert.ok(news[0].occurredOn >= fallsChurch.occurredOn);

  const litchfield = byId.get("news-b18388dab5aaea06");
  assert.equal(litchfield.reviewStatus, "published");
  assert.equal(litchfield.verified, true);
  assert.equal(litchfield.outcome, "serious_injury");
  assert.equal(litchfield.severity, "critical");
  assert.equal(litchfield.fatalities, 0);
  assert.equal(litchfield.injured, 1);
  assert.equal(litchfield.victimName, null);
  assert.equal(litchfield.vehicleType, "car");
  assert.equal(litchfield.city, "Litchfield");
  assert.equal(litchfield.stateCode, "CT");
  assert.equal(litchfield.occurredOn, "2026-11-16");
  assert.equal(litchfield.lighting, "dusk");
  assert.equal(litchfield.roadwayType, "Route 118");
  assert.match(litchfield.summary, /4:58/);
  assert.match(litchfield.summary, /life-threatening/);
  assert.match(litchfield.context, /subscription-only/);
  assert.equal(litchfield.latitude, 41.74603);
  assert.equal(litchfield.longitude, -73.17553);
  assert.equal(litchfield.sourceName, "Litchfield.bz");
  assert.equal(
    litchfield.sourceUrl,
    "https://litchfield.bz/2026/11/16/bicyclist-critical-after-being-hit-by-vehicle/",
  );

  const hyannis = byId.get("news-81cc1d0ccf63374b");
  assert.equal(hyannis.reviewStatus, "published");
  assert.equal(hyannis.verified, true);
  assert.equal(hyannis.outcome, "serious_injury");
  assert.equal(hyannis.severity, "critical");
  assert.equal(hyannis.injured, 1);
  assert.equal(hyannis.victimName, null);
  assert.equal(hyannis.vehicleType, null);
  assert.equal(hyannis.city, "Hyannis");
  assert.equal(hyannis.stateCode, "MA");
  assert.equal(hyannis.occurredOn, "2026-11-16");
  assert.equal(hyannis.roadwayType, "South Street");
  assert.match(hyannis.summary, /Pine Avenue/);
  assert.match(hyannis.summary, /Cape Cod Hospital/);
  assert.match(hyannis.context, /Yarmouth Road/);
  assert.equal(hyannis.latitude, 41.64923);
  assert.equal(hyannis.longitude, -70.28766);
  assert.equal(hyannis.sourceName, "Hyannis News");

  const bagley = byId.get("news-42f0fedc2a63a584");
  assert.equal(bagley.reviewStatus, "published");
  assert.equal(bagley.verified, true);
  assert.equal(bagley.outcome, "serious_injury");
  assert.equal(bagley.severity, "high");
  assert.equal(bagley.injured, 1);
  assert.equal(bagley.victimName, "Shawn Mitchell Bagley");
  assert.equal(bagley.victimAgeBand, "20\u201329");
  assert.equal(bagley.crashType, "hit-from-behind");
  assert.equal(bagley.vehicleType, "pickup");
  assert.equal(bagley.city, "Kasota Township");
  assert.equal(bagley.stateCode, "MN");
  assert.equal(bagley.region, "Midwest");
  assert.equal(bagley.occurredOn, "2026-11-15");
  assert.equal(bagley.latitude, null);
  assert.equal(bagley.longitude, null);
  assert.match(bagley.summary, /Marcus Duane Mutschler/);
  assert.match(bagley.summary, /Ram 1500/);
  assert.match(bagley.context, /no pin/i);
  assert.equal(bagley.sourceName, "St. Peter Herald");

  const farmingville = byId.get("news-9d949016c34512bb");
  assert.equal(farmingville.reviewStatus, "published");
  assert.equal(farmingville.verified, true);
  assert.equal(farmingville.outcome, "serious_injury");
  assert.equal(farmingville.severity, "high");
  assert.equal(farmingville.injured, 1);
  assert.equal(farmingville.victimName, null);
  assert.equal(farmingville.vehicleType, "car");
  assert.equal(farmingville.city, "Farmingville");
  assert.equal(farmingville.stateCode, "NY");
  assert.equal(farmingville.occurredOn, "2026-11-14");
  assert.equal(farmingville.roadwayType, "Horseblock Road");
  assert.match(farmingville.summary, /Stop & Shop/);
  assert.match(farmingville.summary, /Stony Brook/);
  assert.equal(farmingville.latitude, 40.83006);
  assert.equal(farmingville.longitude, -73.02129);
  assert.equal(farmingville.sourceName, "Patch");

  const sterling = byId.get("news-3c1bf442a900adaa");
  assert.equal(sterling.reviewStatus, "published");
  assert.equal(sterling.verified, true);
  assert.equal(sterling.outcome, "serious_injury");
  assert.equal(sterling.severity, "high");
  assert.equal(sterling.fatalities, 0);
  assert.equal(sterling.injured, 1);
  assert.equal(sterling.victimName, null);
  assert.equal(sterling.victimAgeBand, null);
  assert.equal(sterling.crashType, "hit-and-run");
  assert.equal(sterling.driverStatus, "charged");
  assert.equal(sterling.helmet, "yes");
  assert.equal(sterling.vehicleType, null);
  assert.equal(sterling.city, "Sterling Ranch");
  assert.equal(sterling.stateCode, "CO");
  assert.equal(sterling.region, "West");
  assert.equal(sterling.occurredOn, "2026-11-13");
  assert.equal(sterling.roadwayType, "Middle Fork Street");
  assert.match(sterling.summary, /Emily Nicholls/);
  assert.match(sterling.summary, /minor/);
  assert.match(sterling.context, /John Adams Academy/);
  assert.equal(sterling.latitude, 39.48354);
  assert.equal(sterling.longitude, -105.04219);
  assert.equal(sterling.sourceName, "CBS Colorado");
  assert.equal(
    sterling.sourceUrl,
    "https://www.cbsnews.com/colorado/news/colorado-deputies-arrest-hit-run-suspect-child-riding-bicycle-sterling-ranch/",
  );

  const riverside = byId.get("news-1dc762c9a53c8267");
  assert.equal(riverside.reviewStatus, "pending");
  assert.equal(riverside.verified, false);
  assert.equal(riverside.outcome, "serious_injury");
  assert.equal(riverside.severity, "moderate");
  assert.equal(riverside.injured, 1);
  assert.equal(riverside.victimName, null);
  assert.equal(riverside.city, "Riverside");
  assert.equal(riverside.stateCode, "CA");
  assert.equal(riverside.occurredOn, "2026-11-14");
  assert.match(riverside.summary, /RIV 26-43190/);
  assert.match(riverside.context, /bicycle or was on foot/i);
  assert.match(riverside.context, /David Perry/);
  assert.equal(riverside.latitude, 33.92756);
  assert.equal(riverside.longitude, -117.41984);
  assert.equal(riverside.sourceName, "Riverside Fire Department");
  assert.equal(riverside.sourceUrl, "https://riversideca.gov/fire/incident/adams-street-incident");

  const published = [fallsChurch, litchfield, hyannis, bagley, farmingville, sterling];
  assert.equal(published.filter((row) => row.outcome === "killed").length, 1);
  assert.equal(published.filter((row) => row.outcome === "serious_injury").length, 5);
  assert.ok(published.every((row) => row.verified === true && row.reviewStatus === "published"));
  assert.ok(published.every((row) => row.ingestSource === "news" && row.datePrecision === "day"));
  assert.equal(riverside.reviewStatus, "pending");
  assert.equal(
    news.filter((row) => row.city === "Chico" && row.occurredOn === "2026-11-14").length,
    1,
  );
  assert.equal(
    news.filter((row) => row.city === "Commerce" && row.occurredOn === "2026-11-15").length,
    1,
  );
  assert.equal(news.filter((row) => row.victimName === "Shawn Mitchell Bagley").length, 1);
  assert.equal(news.filter((row) => /Emily Nicholls/.test(row.summary)).length, 1);

  const ids = new Set(news.map((row) => row.id));
  assert.equal(ids.size, news.length);
  const prepared = prepareImports(root);
  for (const row of [...published, riverside]) {
    assert.ok(
      prepared.news.some((item) => item.id === row.id),
      row.id,
    );
  }
});

test("Nov 18 2026 desk sweep records the East Falls Church death and publishes the confirmed crashes", () => {
  const news = JSON.parse(readFileSync(join(root, "data/crash-imports/news.json"), "utf8"));
  const byId = new Map(news.map((row) => [row.id, row]));

  const fallsChurch = byId.get("news-e38d3d84143dcb10");
  assert.equal(fallsChurch.reviewStatus, "published");
  assert.equal(fallsChurch.verified, true);
  assert.equal(fallsChurch.outcome, "killed");
  assert.equal(fallsChurch.severity, "critical");
  assert.equal(fallsChurch.fatalities, 1);
  assert.equal(fallsChurch.injured, 0);
  assert.equal(fallsChurch.victimName, "Nicholas Filbert");
  assert.equal(fallsChurch.occurredOn, "2026-11-16");
  assert.equal(fallsChurch.city, "East Falls Church");
  assert.match(fallsChurch.summary, /pronounced dead/);
  assert.match(fallsChurch.summary, /against the light/);
  assert.match(fallsChurch.context, /not released|withholding his name/i);
  assert.equal(fallsChurch.sourceName, "ARLnow");

  const vegas = byId.get("news-5fef14190928d963");
  assert.equal(vegas.reviewStatus, "published");
  assert.equal(vegas.verified, true);
  assert.equal(vegas.ingestSource, "news");
  assert.equal(vegas.outcome, "serious_injury");
  assert.equal(vegas.severity, "low");
  assert.equal(vegas.fatalities, 0);
  assert.equal(vegas.injured, 1);
  assert.equal(vegas.victimName, null);
  assert.equal(vegas.crashType, "intersection");
  assert.equal(vegas.city, "Las Vegas");
  assert.equal(vegas.stateCode, "NV");
  assert.equal(vegas.region, "West");
  assert.equal(vegas.occurredOn, "2026-11-17");
  assert.equal(vegas.datePrecision, "day");
  assert.equal(vegas.lighting, "dusk");
  assert.equal(vegas.roadwayType, "Cactus Avenue");
  assert.match(vegas.summary, /4:41/);
  assert.match(vegas.summary, /Jones Boulevard/);
  assert.match(vegas.summary, /minor injuries/);
  assert.match(vegas.context, /not a surveyed crash coordinate/);
  assert.equal(vegas.latitude, 35.99867);
  assert.equal(vegas.longitude, -115.22551);
  assert.equal(vegas.locationPrecision, "town");
  assert.equal(vegas.sourceName, "KSNV");
  assert.ok(news[0].occurredOn >= vegas.occurredOn);

  const kailua = byId.get("news-060592f408cd3777");
  assert.equal(kailua.reviewStatus, "published");
  assert.equal(kailua.verified, true);
  assert.equal(kailua.outcome, "serious_injury");
  assert.equal(kailua.severity, "high");
  assert.equal(kailua.fatalities, 0);
  assert.equal(kailua.injured, 1);
  assert.equal(kailua.victimName, null);
  assert.equal(kailua.victimAgeBand, "10\u201319");
  assert.equal(kailua.helmet, "no");
  assert.equal(kailua.vehicleType, "bus");
  assert.equal(kailua.city, "Kailua");
  assert.equal(kailua.stateCode, "HI");
  assert.equal(kailua.region, "West");
  assert.equal(kailua.occurredOn, "2026-11-17");
  assert.equal(kailua.roadwayType, "North Kainalu Drive");
  assert.match(kailua.summary, /school bus/);
  assert.match(kailua.summary, /Ohana Street/);
  assert.equal(kailua.latitude, 21.39774);
  assert.equal(kailua.longitude, -157.73963);
  assert.equal(kailua.locationPrecision, "town");
  assert.equal(kailua.sourceName, "KITV");

  const kaufman = byId.get("news-bd8554394fb0d6eb");
  assert.equal(kaufman.reviewStatus, "published");
  assert.equal(kaufman.verified, true);
  assert.equal(kaufman.outcome, "killed");
  assert.equal(kaufman.severity, "critical");
  assert.equal(kaufman.fatalities, 1);
  assert.equal(kaufman.injured, 0);
  assert.equal(kaufman.victimName, null);
  assert.equal(kaufman.crashType, "hit-from-behind");
  assert.equal(kaufman.vehicleType, "car");
  assert.equal(kaufman.city, "Kaufman");
  assert.equal(kaufman.stateCode, "TX");
  assert.equal(kaufman.region, "South");
  assert.equal(kaufman.occurredOn, "2026-11-16");
  assert.equal(kaufman.roadwayType, "State Highway 243");
  assert.match(kaufman.summary, /Ford Escape/);
  assert.match(kaufman.summary, /7 a\.m\./);
  assert.match(kaufman.context, /pedestrian/);
  assert.equal(kaufman.latitude, 32.58678);
  assert.equal(kaufman.longitude, -96.30868);
  assert.equal(kaufman.locationPrecision, "town");
  assert.equal(kaufman.sourceName, "WFAA");

  const frisby = byId.get("news-23564ce1aef1987b");
  assert.equal(frisby.reviewStatus, "published");
  assert.equal(frisby.verified, true);
  assert.equal(frisby.outcome, "killed");
  assert.equal(frisby.severity, "critical");
  assert.equal(frisby.fatalities, 1);
  assert.equal(frisby.injured, 0);
  assert.equal(frisby.victimName, "Skye Tyler Frisby");
  assert.equal(frisby.victimAgeBand, "20\u201329");
  assert.equal(frisby.helmet, "no");
  assert.equal(frisby.vehicleType, "SUV");
  assert.equal(frisby.crashType, "intersection");
  assert.equal(frisby.driverStatus, "at_scene");
  assert.equal(frisby.city, "Lake Worth Beach");
  assert.equal(frisby.stateCode, "FL");
  assert.equal(frisby.occurredOn, "2026-11-13");
  assert.equal(frisby.lighting, "dark");
  assert.equal(frisby.roadwayType, "Lake Avenue");
  assert.match(frisby.summary, /Cycrown/);
  assert.match(frisby.summary, /windshield/);
  assert.match(frisby.summary, /Nov\. 16/);
  assert.equal(frisby.latitude, 26.61608);
  assert.equal(frisby.longitude, -80.06326);
  assert.equal(frisby.locationPrecision, "town");
  assert.equal(frisby.sourceName, "WPEC");

  const grass = byId.get("news-baca9b65a1a7bd92");
  assert.equal(grass.reviewStatus, "published");
  assert.equal(grass.verified, true);
  assert.equal(grass.outcome, "killed");
  assert.equal(grass.severity, "critical");
  assert.equal(grass.fatalities, 1);
  assert.equal(grass.injured, 0);
  assert.equal(grass.victimName, null);
  assert.equal(grass.victimAgeBand, "80\u201389");
  assert.equal(grass.crashType, "hit-and-run");
  assert.equal(grass.driverStatus, "fled");
  assert.equal(grass.vehicleType, "minivan");
  assert.equal(grass.city, "Grass Valley");
  assert.equal(grass.stateCode, "CA");
  assert.equal(grass.region, "West");
  assert.equal(grass.occurredOn, "2026-11-11");
  assert.equal(grass.roadwayType, "Brunswick Road");
  assert.match(grass.summary, /Burma Road/);
  assert.match(grass.summary, /Mazda MPV/);
  assert.match(grass.context, /did not name/);
  assert.equal(grass.latitude, 39.19881);
  assert.equal(grass.longitude, -121.01075);
  assert.equal(grass.locationPrecision, "town");
  assert.equal(grass.sourceName, "The Union");

  const mcgraw = byId.get("news-034d6f9a904fa4d2");
  assert.equal(mcgraw.reviewStatus, "published");
  assert.equal(mcgraw.verified, true);
  assert.equal(mcgraw.outcome, "killed");
  assert.equal(mcgraw.severity, "critical");
  assert.equal(mcgraw.fatalities, 1);
  assert.equal(mcgraw.injured, 0);
  assert.equal(mcgraw.victimName, "Sheila S. Smith-McGraw");
  assert.equal(mcgraw.victimAgeBand, "50\u201359");
  assert.equal(mcgraw.vehicleType, "SUV");
  assert.equal(mcgraw.city, "Rio Grande");
  assert.equal(mcgraw.stateCode, "NJ");
  assert.equal(mcgraw.region, "Northeast");
  assert.equal(mcgraw.occurredOn, "2026-11-10");
  assert.equal(mcgraw.roadwayType, "Route 47");
  assert.match(mcgraw.summary, /Hawthorne Drive/);
  assert.match(mcgraw.summary, /Chevrolet Trax/);
  assert.match(mcgraw.context, /Sheila S\. McGraw/);
  assert.equal(mcgraw.latitude, 39.01904);
  assert.equal(mcgraw.longitude, -74.88734);
  assert.equal(mcgraw.locationPrecision, "town");
  assert.equal(mcgraw.sourceName, "NJ.com");

  const elkGrove = byId.get("news-6ee8392311b134eb");
  assert.equal(elkGrove.reviewStatus, "published");
  assert.equal(elkGrove.outcome, "serious_injury");
  assert.equal(elkGrove.fatalities, 0);
  assert.equal(elkGrove.injured, 1);
  assert.equal(elkGrove.city, "Elk Grove");
  assert.equal(elkGrove.occurredOn, "2026-11-05");
  assert.equal(elkGrove.roadwayType, "Willard Parkway");
  assert.equal(
    news.filter((row) => row.city === "Elk Grove" && row.occurredOn === "2026-11-05").length,
    1,
  );

  const bagley = byId.get("news-42f0fedc2a63a584");
  assert.equal(bagley.reviewStatus, "published");
  assert.equal(bagley.victimName, "Shawn Mitchell Bagley");
  assert.equal(bagley.city, "Kasota Township");
  assert.equal(bagley.occurredOn, "2026-11-15");
  assert.equal(news.filter((row) => row.victimName === "Shawn Mitchell Bagley").length, 1);
  assert.equal(news.filter((row) => row.city === "Saint Peter" || row.city === "St. Peter").length, 0);

  const published = [vegas, kailua, kaufman, frisby, grass, mcgraw];
  assert.equal(published.filter((row) => row.outcome === "killed").length, 4);
  assert.equal(published.filter((row) => row.outcome === "serious_injury").length, 2);
  assert.ok(published.every((row) => row.verified === true && row.reviewStatus === "published"));
  assert.ok(published.every((row) => row.ingestSource === "news" && row.datePrecision === "day"));
  assert.equal(news.filter((row) => row.victimName === "Skye Tyler Frisby").length, 1);
  assert.equal(news.filter((row) => row.victimName === "Sheila S. Smith-McGraw").length, 1);
  assert.equal(news.filter((row) => row.city === "Grass Valley" && row.occurredOn === "2026-11-11").length, 1);
  assert.equal(news.filter((row) => row.city === "Las Vegas" && row.occurredOn === "2026-11-17").length, 1);

  const ids = new Set(news.map((row) => row.id));
  assert.equal(ids.size, news.length);
  const prepared = prepareImports(root);
  for (const row of [...published, fallsChurch]) {
    assert.ok(
      prepared.news.some((item) => item.id === row.id),
      row.id,
    );
  }
});

test("Nov 19 2026 desk sweep publishes confirmed crashes and queues the unclear ones", () => {
  const news = JSON.parse(readFileSync(join(root, "data/crash-imports/news.json"), "utf8"));
  const byId = new Map(news.map((row) => [row.id, row]));

  const bay = byId.get("news-4eab62cfdd23f147");
  assert.equal(bay.reviewStatus, "published");
  assert.equal(bay.verified, true);
  assert.equal(bay.ingestSource, "news");
  assert.equal(bay.outcome, "killed");
  assert.equal(bay.severity, "critical");
  assert.equal(bay.fatalities, 1);
  assert.equal(bay.injured, 0);
  assert.equal(bay.victimName, null);
  assert.equal(bay.victimAgeBand, "50\u201359");
  assert.equal(bay.crashType, "right-hook");
  assert.equal(bay.vehicleType, "flatbed truck");
  assert.equal(bay.city, "Panama City Beach");
  assert.equal(bay.stateCode, "FL");
  assert.equal(bay.region, "South");
  assert.equal(bay.occurredOn, "2026-11-18");
  assert.equal(bay.datePrecision, "day");
  assert.equal(bay.lighting, "daylight");
  assert.equal(bay.roadwayType, "Panama City Beach Parkway");
  assert.match(bay.summary, /58-year-old/);
  assert.match(bay.summary, /Marianna/);
  assert.match(bay.summary, /North Lakeshore Drive/);
  assert.match(bay.summary, /not released/);
  assert.match(bay.context, /not a surveyed crash coordinate/);
  assert.equal(bay.latitude, 30.24402);
  assert.equal(bay.longitude, -85.91992);
  assert.equal(bay.locationPrecision, "town");
  assert.equal(bay.sourceName, "WJHG");
  assert.ok(news[0].occurredOn >= bay.occurredOn);
  assert.equal(
    googleMapsSearchUrl({
      latitude: bay.latitude,
      longitude: bay.longitude,
      locationName: bay.locationName,
      city: bay.city,
      state: bay.state,
    }),
    "https://www.google.com/maps/search/?api=1&query=30.24402,-85.91992",
  );

  const pell = byId.get("news-704cc17e00e63d4a");
  assert.equal(pell.reviewStatus, "published");
  assert.equal(pell.verified, true);
  assert.equal(pell.outcome, "serious_injury");
  assert.equal(pell.severity, "critical");
  assert.equal(pell.fatalities, 0);
  assert.equal(pell.injured, 1);
  assert.equal(pell.victimName, null);
  assert.equal(pell.crashType, "intersection");
  assert.equal(pell.driverStatus, "at_scene");
  assert.equal(pell.vehicleType, "car");
  assert.equal(pell.city, "Pell City");
  assert.equal(pell.stateCode, "AL");
  assert.equal(pell.region, "South");
  assert.equal(pell.occurredOn, "2026-11-18");
  assert.equal(pell.roadwayType, "US 231");
  assert.match(pell.summary, /5:30 p\.m\./);
  assert.match(pell.summary, /UAB Hospital/);
  assert.match(pell.context, /Huddle House/);
  assert.match(pell.context, /Martin Street North/);
  assert.equal(pell.latitude, 33.59007);
  assert.equal(pell.longitude, -86.28136);
  assert.equal(pell.sourceName, "WBRC");

  const sycamore = byId.get("news-5685d58338580569");
  assert.equal(sycamore.reviewStatus, "published");
  assert.equal(sycamore.verified, true);
  assert.equal(sycamore.outcome, "serious_injury");
  assert.equal(sycamore.severity, "high");
  assert.equal(sycamore.injured, 1);
  assert.equal(sycamore.victimName, null);
  assert.equal(sycamore.vehicleType, "car");
  assert.equal(sycamore.city, "Sycamore");
  assert.equal(sycamore.stateCode, "IL");
  assert.equal(sycamore.region, "Midwest");
  assert.equal(sycamore.occurredOn, "2026-11-18");
  assert.equal(sycamore.roadwayType, "DeKalb Avenue");
  assert.match(sycamore.summary, /McDonald's/);
  assert.match(sycamore.summary, /1660 DeKalb/);
  assert.match(sycamore.context, /over 60/);
  assert.equal(sycamore.latitude, 41.97396);
  assert.equal(sycamore.longitude, -88.71695);
  assert.equal(sycamore.sourceName, "Shaw Local");

  const peterson = byId.get("news-b51747213632553d");
  assert.equal(peterson.reviewStatus, "published");
  assert.equal(peterson.verified, true);
  assert.equal(peterson.outcome, "serious_injury");
  assert.equal(peterson.victimName, "Judah Peterson");
  assert.equal(peterson.crashType, "left-cross");
  assert.equal(peterson.city, "Goshen");
  assert.equal(peterson.stateCode, "IN");
  assert.equal(peterson.occurredOn, "2026-11-17");
  assert.equal(peterson.roadwayType, "Lakeview Drive");
  assert.match(peterson.summary, /Audrey Clark/);
  assert.match(peterson.context, /Oct\. 26/);
  assert.equal(peterson.latitude, 41.60338);
  assert.equal(peterson.longitude, -85.83454);
  assert.equal(peterson.sourceName, "The Goshen News");

  const farmington = byId.get("news-15fe431888e9a89b");
  assert.equal(farmington.reviewStatus, "published");
  assert.equal(farmington.verified, true);
  assert.equal(farmington.outcome, "serious_injury");
  assert.equal(farmington.severity, "low");
  assert.equal(farmington.victimName, null);
  assert.equal(farmington.victimAgeBand, "10\u201319");
  assert.equal(farmington.city, "Farmington");
  assert.equal(farmington.stateCode, "MI");
  assert.equal(farmington.occurredOn, "2026-11-17");
  assert.equal(farmington.roadwayType, "Orchard Lake Road");
  assert.match(farmington.summary, /minor injuries/);
  assert.match(farmington.summary, /15-year-old/);
  assert.match(farmington.context, /Daniel Grechin-Pirogov/);
  assert.equal(farmington.latitude, 42.46144);
  assert.equal(farmington.longitude, -83.35675);
  assert.equal(farmington.sourceName, "The Oakland Press");

  const pleasantville = byId.get("news-ec502096a10a8c4f");
  assert.equal(pleasantville.reviewStatus, "published");
  assert.equal(pleasantville.verified, true);
  assert.equal(pleasantville.outcome, "serious_injury");
  assert.equal(pleasantville.injured, 2);
  assert.equal(pleasantville.victimName, "Daniel Rodriguez Jr.");
  assert.equal(pleasantville.victimAgeBand, "10\u201319");
  assert.equal(pleasantville.crashType, "right-hook");
  assert.equal(pleasantville.city, "Pleasantville");
  assert.equal(pleasantville.stateCode, "NJ");
  assert.equal(pleasantville.region, "Northeast");
  assert.equal(pleasantville.occurredOn, "2026-11-16");
  assert.equal(pleasantville.roadwayType, "North New Road");
  assert.match(pleasantville.summary, /16-year-old/);
  assert.match(pleasantville.summary, /Maayana Kelly/);
  assert.equal(pleasantville.latitude, 39.40642);
  assert.equal(pleasantville.longitude, -74.5212);
  assert.equal(pleasantville.sourceName, "Breaking AC");

  const topeka = byId.get("news-300fde08f89b3e9c");
  assert.equal(topeka.reviewStatus, "published");
  assert.equal(topeka.verified, true);
  assert.equal(topeka.outcome, "serious_injury");
  assert.equal(topeka.severity, "low");
  assert.equal(topeka.victimName, null);
  assert.equal(topeka.vehicleType, "car");
  assert.equal(topeka.city, "Topeka");
  assert.equal(topeka.stateCode, "KS");
  assert.equal(topeka.occurredOn, "2026-11-16");
  assert.equal(topeka.roadwayType, "Southwest 29th Street");
  assert.match(topeka.summary, /minor injuries/);
  assert.match(topeka.summary, /Wanamaker/);
  assert.equal(topeka.latitude, 39.01458);
  assert.equal(topeka.longitude, -95.76237);
  assert.equal(topeka.sourceName, "WIBW");

  const woodland = byId.get("news-140737f3f06c032f");
  assert.equal(woodland.reviewStatus, "published");
  assert.equal(woodland.verified, true);
  assert.equal(woodland.outcome, "serious_injury");
  assert.equal(woodland.severity, "critical");
  assert.equal(woodland.crashType, "hit-and-run");
  assert.equal(woodland.driverStatus, "fled");
  assert.equal(woodland.vehicleType, "SUV");
  assert.equal(woodland.victimName, null);
  assert.equal(woodland.city, "Woodland Hills");
  assert.equal(woodland.stateCode, "CA");
  assert.equal(woodland.region, "West");
  assert.equal(woodland.occurredOn, "2026-11-03");
  assert.equal(woodland.roadwayType, "De Soto Avenue");
  assert.match(woodland.summary, /Ford Explorer/);
  assert.match(woodland.context, /Victory Boulevard/);
  assert.equal(woodland.latitude, 34.18835);
  assert.equal(woodland.longitude, -118.58845);
  assert.equal(woodland.sourceName, "KTLA");

  const longBeach = byId.get("news-5f1b2d18f84d38ce");
  assert.equal(longBeach.reviewStatus, "published");
  assert.equal(longBeach.verified, true);
  assert.equal(longBeach.outcome, "serious_injury");
  assert.equal(longBeach.severity, "moderate");
  assert.equal(longBeach.crashType, "hit-and-run");
  assert.equal(longBeach.driverStatus, "fled");
  assert.equal(longBeach.city, "Long Beach");
  assert.equal(longBeach.stateCode, "CA");
  assert.equal(longBeach.occurredOn, "2026-10-26");
  assert.equal(longBeach.roadwayType, "Pacific Coast Highway");
  assert.match(longBeach.summary, /moderate injuries/);
  assert.match(longBeach.summary, /1400 block/);
  assert.match(longBeach.context, /1400 East/);
  assert.equal(longBeach.latitude, 33.78979);
  assert.equal(longBeach.longitude, -118.17409);
  assert.equal(longBeach.sourceName, "CBS Los Angeles");

  const pickett = byId.get("news-68ac40aeb0ef5f9b");
  assert.equal(pickett.reviewStatus, "published");
  assert.equal(pickett.verified, true);
  assert.equal(pickett.outcome, "killed");
  assert.equal(pickett.severity, "critical");
  assert.equal(pickett.fatalities, 1);
  assert.equal(pickett.injured, 0);
  assert.equal(pickett.victimName, "Dallas Pickett");
  assert.equal(pickett.victimAgeBand, "70\u201379");
  assert.equal(pickett.crashType, "hit-and-run");
  assert.equal(pickett.driverStatus, "fled");
  assert.equal(pickett.vehicleType, "SUV");
  assert.equal(pickett.city, "Chicago");
  assert.equal(pickett.stateCode, "IL");
  assert.equal(pickett.locationName, "Kenwood, Chicago, Illinois");
  assert.equal(pickett.occurredOn, "2026-09-17");
  assert.equal(pickett.roadwayType, "South Lake Park Avenue");
  assert.match(pickett.summary, /Oct\. 5/);
  assert.match(pickett.summary, /Jeep/);
  assert.equal(pickett.latitude, 41.80405);
  assert.equal(pickett.longitude, -87.58854);
  assert.equal(pickett.sourceName, "Streetsblog Chicago");

  const alton = byId.get("news-9e81e78a839826ad");
  assert.equal(alton.reviewStatus, "pending");
  assert.equal(alton.verified, false);
  assert.equal(alton.outcome, "serious_injury");
  assert.equal(alton.severity, "critical");
  assert.equal(alton.victimName, null);
  assert.equal(alton.crashType, "hit-and-run");
  assert.equal(alton.driverStatus, "fled");
  assert.equal(alton.city, "Alton");
  assert.equal(alton.stateCode, "IL");
  assert.equal(alton.occurredOn, "2026-11-17");
  assert.match(alton.summary, /pushing a bicycle/);
  assert.match(alton.context, /not riding it/);
  assert.equal(alton.latitude, 38.8883);
  assert.equal(alton.longitude, -90.12934);
  assert.equal(alton.sourceName, "RiverBender");

  const tyler = byId.get("news-8303246637c6d3ed");
  assert.equal(tyler.reviewStatus, "pending");
  assert.equal(tyler.verified, false);
  assert.equal(tyler.outcome, "serious_injury");
  assert.equal(tyler.injured, 0);
  assert.equal(tyler.fatalities, 0);
  assert.equal(tyler.victimName, null);
  assert.equal(tyler.city, "Tyler");
  assert.equal(tyler.stateCode, "TX");
  assert.equal(tyler.occurredOn, "2026-11-17");
  assert.equal(tyler.datePrecision, "published");
  assert.match(tyler.summary, /no injuries were reported/i);
  assert.match(tyler.context, /injury was not established/i);
  assert.equal(tyler.latitude, 32.3032);
  assert.equal(tyler.longitude, -95.27889);
  assert.equal(tyler.sourceName, "KLTV");

  const published = [bay, pell, sycamore, peterson, farmington, pleasantville, topeka, woodland, longBeach, pickett];
  assert.equal(published.filter((row) => row.outcome === "killed").length, 2);
  assert.equal(published.filter((row) => row.outcome === "serious_injury").length, 8);
  assert.ok(published.every((row) => row.verified === true && row.reviewStatus === "published"));
  assert.ok(published.every((row) => row.ingestSource === "news" && row.datePrecision === "day"));
  assert.equal(alton.reviewStatus, "pending");
  assert.equal(tyler.reviewStatus, "pending");
  assert.equal(news.filter((row) => row.victimName === "Judah Peterson").length, 1);
  assert.equal(news.filter((row) => row.victimName === "Daniel Rodriguez Jr.").length, 1);
  assert.equal(news.filter((row) => row.victimName === "Dallas Pickett").length, 1);
  assert.equal(news.filter((row) => row.victimName === "Patrick Allen Turner").length, 1);
  assert.equal(news.filter((row) => row.city === "Holly Springs" && row.occurredOn === "2026-11-07").length, 1);
  assert.equal(news.filter((row) => row.city === "Haddam").length, 0);
  assert.equal(news.filter((row) => row.city === "Pell City" && row.occurredOn === "2026-11-18").length, 1);
  assert.equal(news.filter((row) => row.city === "Panama City Beach" && row.occurredOn === "2026-11-18").length, 1);
  assert.equal(news.filter((row) => row.city === "East Falls Church" && row.occurredOn === "2026-11-16").length, 1);

  const ids = new Set(news.map((row) => row.id));
  assert.equal(ids.size, news.length);
  const prepared = prepareImports(root);
  for (const row of [...published, alton, tyler]) {
    assert.ok(
      prepared.news.some((item) => item.id === row.id),
      row.id,
    );
  }
});

test("Nov 20 2026 desk sweep publishes confirmed crashes and skips the non-cyclist leads", () => {
  const news = JSON.parse(readFileSync(join(root, "data/crash-imports/news.json"), "utf8"));
  const byId = new Map(news.map((row) => [row.id, row]));

  const covington = byId.get("news-0783b439e7501464");
  assert.equal(covington.reviewStatus, "published");
  assert.equal(covington.verified, true);
  assert.equal(covington.ingestSource, "news");
  assert.equal(covington.outcome, "killed");
  assert.equal(covington.severity, "critical");
  assert.equal(covington.fatalities, 1);
  assert.equal(covington.injured, 0);
  assert.equal(covington.victimName, null);
  assert.equal(covington.victimAgeBand, "40\u201349");
  assert.equal(covington.crashType, "hit-from-behind");
  assert.equal(covington.vehicleType, "SUV");
  assert.equal(covington.driverStatus, "at_scene");
  assert.equal(covington.helmet, "no");
  assert.equal(covington.city, "Covington");
  assert.equal(covington.stateCode, "LA");
  assert.equal(covington.region, "South");
  assert.equal(covington.occurredOn, "2026-11-18");
  assert.equal(covington.datePrecision, "day");
  assert.equal(covington.lighting, "dark");
  assert.equal(covington.roadwayType, "Louisiana Highway 1081");
  assert.match(covington.summary, /43-year-old/);
  assert.match(covington.summary, /Slidell/);
  assert.match(covington.summary, /Highway 437/);
  assert.match(covington.summary, /not released/);
  assert.match(covington.context, /not a surveyed crash coordinate/);
  assert.equal(covington.latitude, 30.517);
  assert.equal(covington.longitude, -90.07478);
  assert.equal(covington.locationPrecision, "town");
  assert.equal(covington.sourceName, "Louisiana State Police");
  assert.ok(news.some((row) => row.id === covington.id));
  assert.equal(
    googleMapsSearchUrl({
      latitude: covington.latitude,
      longitude: covington.longitude,
      locationName: covington.locationName,
      city: covington.city,
      state: covington.state,
    }),
    "https://www.google.com/maps/search/?api=1&query=30.517,-90.07478",
  );

  const desert = byId.get("news-222e875f65113120");
  assert.equal(desert.reviewStatus, "published");
  assert.equal(desert.verified, true);
  assert.equal(desert.outcome, "serious_injury");
  assert.equal(desert.severity, "high");
  assert.equal(desert.fatalities, 0);
  assert.equal(desert.injured, 1);
  assert.equal(desert.victimName, null);
  assert.equal(desert.driverStatus, "unknown");
  assert.equal(desert.city, "Desert Hot Springs");
  assert.equal(desert.stateCode, "CA");
  assert.equal(desert.region, "West");
  assert.equal(desert.occurredOn, "2026-11-19");
  assert.equal(desert.roadwayType, "Dillon Road");
  assert.match(desert.summary, /1:20 p\.m\./);
  assert.match(desert.summary, /70040 block/);
  assert.match(desert.summary, /one hand/);
  assert.match(desert.context, /pedestrian/);
  assert.equal(desert.latitude, 33.92532);
  assert.equal(desert.longitude, -116.44002);
  assert.equal(desert.sourceName, "KESQ");

  const officer = byId.get("news-f7c756424216c31b");
  assert.equal(officer.reviewStatus, "published");
  assert.equal(officer.verified, true);
  assert.equal(officer.outcome, "serious_injury");
  assert.equal(officer.severity, "low");
  assert.equal(officer.injured, 1);
  assert.equal(officer.victimName, null);
  assert.equal(officer.vehicleType, "car");
  assert.equal(officer.city, "San Antonio");
  assert.equal(officer.stateCode, "TX");
  assert.equal(officer.region, "South");
  assert.equal(officer.occurredOn, "2026-11-19");
  assert.equal(officer.latitude, null);
  assert.equal(officer.longitude, null);
  assert.match(officer.summary, /bruising/);
  assert.match(officer.summary, /bicycle officer/);
  assert.match(officer.context, /no pin/i);
  assert.equal(officer.sourceName, "News 4 San Antonio");

  const frederick = byId.get("news-2bf3fa7917324fe1");
  assert.equal(frederick.reviewStatus, "published");
  assert.equal(frederick.verified, true);
  assert.equal(frederick.outcome, "serious_injury");
  assert.equal(frederick.severity, "moderate");
  assert.equal(frederick.victimName, "Bryan Russell Frederick");
  assert.equal(frederick.victimAgeBand, "70\u201379");
  assert.equal(frederick.vehicleType, "SUV");
  assert.equal(frederick.city, "Milaca");
  assert.equal(frederick.stateCode, "MN");
  assert.equal(frederick.region, "Midwest");
  assert.equal(frederick.occurredOn, "2026-11-18");
  assert.equal(frederick.roadwayType, "Highway 23");
  assert.match(frederick.summary, /Lisa Sue Hill/);
  assert.match(frederick.summary, /non-life-threatening/);
  assert.match(frederick.summary, /125th Avenue/);
  assert.equal(frederick.latitude, 45.74643);
  assert.equal(frederick.longitude, -93.66776);
  assert.equal(frederick.sourceName, "Brainerd Dispatch");

  const cane = byId.get("news-3cea0a7102cd27b5");
  assert.equal(cane.reviewStatus, "published");
  assert.equal(cane.verified, true);
  assert.equal(cane.outcome, "serious_injury");
  assert.equal(cane.severity, "high");
  assert.equal(cane.injured, 1);
  assert.equal(cane.victimName, null);
  assert.equal(cane.city, "Cane Bay");
  assert.equal(cane.stateCode, "SC");
  assert.equal(cane.region, "South");
  assert.equal(cane.locationName, "Cane Bay, Berkeley County, South Carolina");
  assert.equal(cane.occurredOn, "2026-11-10");
  assert.equal(cane.roadwayType, "Cane Bay Boulevard");
  assert.match(cane.summary, /1655 Cane Bay/);
  assert.match(cane.summary, /hospitalized/);
  assert.match(cane.context, /OpenStreetMap/);
  assert.equal(cane.latitude, 33.12424);
  assert.equal(cane.longitude, -80.10323);
  assert.equal(cane.sourceName, "WCIV");

  const published = [covington, desert, officer, frederick, cane];
  assert.equal(published.filter((row) => row.outcome === "killed").length, 1);
  assert.equal(published.filter((row) => row.outcome === "serious_injury").length, 4);
  assert.ok(published.every((row) => row.verified === true && row.reviewStatus === "published"));
  assert.ok(published.every((row) => row.ingestSource === "news" && row.datePrecision === "day"));
  assert.equal(news.filter((row) => row.victimName === "Bryan Russell Frederick").length, 1);
  assert.equal(news.filter((row) => row.victimName === "Damon Penny" || row.victimName === "Damon Anthony Penny").length, 0);
  assert.equal(news.filter((row) => row.city === "Point Pleasant" || row.city === "Brick").length, 0);
  assert.equal(news.filter((row) => row.city === "Covington" && row.occurredOn === "2026-11-18").length, 1);
  assert.equal(news.filter((row) => row.city === "Milaca" && row.occurredOn === "2026-11-18").length, 1);
  assert.equal(news.filter((row) => row.city === "Cane Bay" && row.occurredOn === "2026-11-10").length, 1);
  assert.equal(news.filter((row) => row.city === "Desert Hot Springs" && row.occurredOn === "2026-11-19").length, 1);
  assert.equal(news.filter((row) => row.city === "San Antonio" && row.occurredOn === "2026-11-19").length, 1);
  assert.equal(news.filter((row) => row.city === "Escondido" && row.occurredOn === "2026-10-02").length, 1);
  assert.equal(news.filter((row) => row.city === "Escondido").length, 1);
  assert.equal(news.filter((row) => row.city === "West Palm Beach" && row.occurredOn === "2026-11-11").length, 1);
  assert.equal(news.filter((row) => row.city === "West Palm Beach").length, 1);
  assert.equal(news.filter((row) => row.victimName === "Shawn Mitchell Bagley").length, 1);
  assert.equal(news.filter((row) => row.victimName === "Patrick Allen Turner").length, 1);
  assert.equal(news.filter((row) => row.city === "Holly Springs" && row.occurredOn === "2026-11-07").length, 1);
  assert.equal(news.filter((row) => row.city === "Kasota Township" && row.occurredOn === "2026-11-15").length, 1);

  const ids = new Set(news.map((row) => row.id));
  assert.equal(ids.size, news.length);
  const prepared = prepareImports(root);
  for (const row of published) {
    assert.ok(
      prepared.news.some((item) => item.id === row.id),
      row.id,
    );
  }
});

test("Nov 21 2026 desk sweep publishes confirmed crashes and queues the unverified ones", () => {
  const news = JSON.parse(readFileSync(join(root, "data/crash-imports/news.json"), "utf8"));
  const byId = new Map(news.map((row) => [row.id, row]));

  const philadelphia = byId.get("news-508666b20ac0eac4");
  assert.equal(philadelphia.reviewStatus, "published");
  assert.equal(philadelphia.verified, true);
  assert.equal(philadelphia.outcome, "killed");
  assert.equal(philadelphia.severity, "critical");
  assert.equal(philadelphia.fatalities, 1);
  assert.equal(philadelphia.injured, 0);
  assert.equal(philadelphia.victimName, null);
  assert.equal(philadelphia.victimAgeBand, "20\u201329");
  assert.equal(philadelphia.city, "Philadelphia");
  assert.equal(philadelphia.stateCode, "PA");
  assert.equal(philadelphia.region, "Northeast");
  assert.equal(philadelphia.occurredOn, "2026-11-20");
  assert.equal(philadelphia.datePrecision, "day");
  assert.equal(philadelphia.roadwayType, "West Passyunk Avenue");
  assert.equal(philadelphia.vehicleType, "car");
  assert.equal(philadelphia.driverStatus, "at_scene");
  assert.equal(philadelphia.lighting, "dark");
  assert.match(philadelphia.summary, /28-year-old/);
  assert.match(philadelphia.summary, /6:13 a\.m\./);
  assert.match(philadelphia.summary, /not released/);
  assert.match(philadelphia.context, /6:49 p\.m\./);
  assert.match(philadelphia.context, /6100 block/);
  assert.equal(philadelphia.latitude, 39.92086);
  assert.equal(philadelphia.longitude, -75.19559);
  assert.equal(philadelphia.sourceName, "NBC10 Philadelphia");
  assert.ok(news[0].occurredOn >= philadelphia.occurredOn);

  const bangor = byId.get("news-14d9ab14d137229a");
  assert.equal(bangor.reviewStatus, "published");
  assert.equal(bangor.verified, true);
  assert.equal(bangor.outcome, "serious_injury");
  assert.equal(bangor.severity, "critical");
  assert.equal(bangor.injured, 1);
  assert.equal(bangor.fatalities, 0);
  assert.equal(bangor.victimName, null);
  assert.equal(bangor.city, "Bangor");
  assert.equal(bangor.stateCode, "ME");
  assert.equal(bangor.occurredOn, "2026-11-20");
  assert.equal(bangor.roadwayType, "Broadway");
  assert.equal(bangor.lighting, "dark");
  assert.match(bangor.summary, /life-threatening/);
  assert.match(bangor.summary, /School Street/);
  assert.match(bangor.summary, /Katy England/);
  assert.equal(bangor.latitude, 44.8246);
  assert.equal(bangor.longitude, -68.78042);
  assert.equal(bangor.sourceName, "Bangor Daily News");

  const selden = byId.get("news-8446c26c94f9adb7");
  assert.equal(selden.reviewStatus, "pending");
  assert.equal(selden.verified, false);
  assert.equal(selden.outcome, "serious_injury");
  assert.equal(selden.city, "Selden");
  assert.equal(selden.stateCode, "NY");
  assert.equal(selden.occurredOn, "2026-11-20");
  assert.equal(selden.crashType, "intersection");
  assert.match(selden.summary, /3:20 p\.m\./);
  assert.match(selden.summary, /Route 25/);
  assert.match(selden.context, /injury is not stated/i);
  assert.match(selden.context, /10:20 p\.m\./);
  assert.equal(selden.latitude, 40.86545);
  assert.equal(selden.longitude, -73.04125);
  assert.equal(selden.sourceName, "Patch");

  const arkadelphia = byId.get("news-e812618b175166e3");
  assert.equal(arkadelphia.reviewStatus, "pending");
  assert.equal(arkadelphia.verified, false);
  assert.equal(arkadelphia.outcome, "serious_injury");
  assert.equal(arkadelphia.city, "Arkadelphia");
  assert.equal(arkadelphia.stateCode, "AR");
  assert.equal(arkadelphia.region, "South");
  assert.equal(arkadelphia.occurredOn, "2026-11-20");
  assert.match(arkadelphia.summary, /pedestrian/);
  assert.match(arkadelphia.summary, /Feaster Trail/);
  assert.match(arkadelphia.context, /no report confirmed the person was riding a bicycle/i);
  assert.equal(arkadelphia.latitude, 34.12775);
  assert.equal(arkadelphia.longitude, -93.08019);
  assert.equal(arkadelphia.sourceName, "CrimeRadar");

  const gorsuch = byId.get("news-d480a5acf19714ce");
  assert.equal(gorsuch.reviewStatus, "published");
  assert.equal(gorsuch.verified, true);
  assert.equal(gorsuch.outcome, "killed");
  assert.equal(gorsuch.fatalities, 1);
  assert.equal(gorsuch.victimName, "Christopher Gorsuch");
  assert.equal(gorsuch.victimAgeBand, "40\u201349");
  assert.equal(gorsuch.city, "London");
  assert.equal(gorsuch.stateCode, "KY");
  assert.equal(gorsuch.region, "South");
  assert.equal(gorsuch.occurredOn, "2026-11-19");
  assert.equal(gorsuch.vehicleType, "car");
  assert.equal(gorsuch.roadwayType, "Maple Grove Road");
  assert.match(gorsuch.summary, /Edith Rich/);
  assert.match(gorsuch.summary, /Pontiac Grand Am/);
  assert.match(gorsuch.summary, /10:40 p\.m\./);
  assert.match(gorsuch.context, /WKYT said Sunday/);
  assert.equal(gorsuch.latitude, 37.06443);
  assert.equal(gorsuch.longitude, -84.11648);
  assert.equal(gorsuch.sourceName, "WYMT");

  const badertscher = byId.get("news-b7672188326140d5");
  assert.equal(badertscher.reviewStatus, "published");
  assert.equal(badertscher.verified, true);
  assert.equal(badertscher.outcome, "killed");
  assert.equal(badertscher.fatalities, 1);
  assert.equal(badertscher.injured, 0);
  assert.equal(badertscher.victimName, "Joseph Robert Badertscher");
  assert.equal(badertscher.victimAgeBand, "60\u201369");
  assert.equal(badertscher.city, "Costa Mesa");
  assert.equal(badertscher.stateCode, "CA");
  assert.equal(badertscher.region, "West");
  assert.equal(badertscher.occurredOn, "2026-11-19");
  assert.equal(badertscher.crashType, "intersection");
  assert.equal(badertscher.lighting, "dark");
  assert.match(badertscher.summary, /e-bike/);
  assert.match(badertscher.summary, /red light/);
  assert.match(badertscher.summary, /Huntington Beach/);
  assert.equal(badertscher.latitude, 33.67253);
  assert.equal(badertscher.longitude, -117.93546);
  assert.equal(badertscher.sourceName, "Los Angeles Times");

  const amherst = byId.get("news-73bb28604b900c35");
  assert.equal(amherst.reviewStatus, "published");
  assert.equal(amherst.verified, true);
  assert.equal(amherst.outcome, "serious_injury");
  assert.equal(amherst.severity, "high");
  assert.equal(amherst.injured, 1);
  assert.equal(amherst.victimName, null);
  assert.equal(amherst.victimAgeBand, "70\u201379");
  assert.equal(amherst.city, "Amherst");
  assert.equal(amherst.stateCode, "NY");
  assert.equal(amherst.occurredOn, "2026-11-19");
  assert.equal(amherst.vehicleType, "car");
  assert.equal(amherst.roadwayType, "Wehrle Drive");
  assert.match(amherst.summary, /Toyota Camry/);
  assert.match(amherst.summary, /76-year-old/);
  assert.match(amherst.summary, /chest and head/);
  assert.equal(amherst.latitude, 42.94963);
  assert.equal(amherst.longitude, -78.7817);
  assert.equal(amherst.sourceName, "WGRZ");

  const andover = byId.get("news-b04d0f84a893408b");
  assert.equal(andover.reviewStatus, "published");
  assert.equal(andover.verified, true);
  assert.equal(andover.outcome, "serious_injury");
  assert.equal(andover.severity, "moderate");
  assert.equal(andover.injured, 1);
  assert.equal(andover.victimName, null);
  assert.equal(andover.city, "Andover");
  assert.equal(andover.stateCode, "MA");
  assert.equal(andover.occurredOn, "2026-11-19");
  assert.equal(andover.vehicleType, "SUV");
  assert.equal(andover.crashType, "intersection");
  assert.match(andover.summary, /Clark and Dascomb/);
  assert.match(andover.summary, /Lawrence General/);
  assert.match(andover.context, /extent of the bicyclist's injuries was not established/i);
  assert.equal(andover.latitude, 42.63288);
  assert.equal(andover.longitude, -71.16815);
  assert.equal(andover.sourceName, "Andover News");

  const vanderpool = byId.get("news-c7ce6ca44a545299");
  assert.equal(vanderpool.reviewStatus, "published");
  assert.equal(vanderpool.verified, true);
  assert.equal(vanderpool.outcome, "killed");
  assert.equal(vanderpool.fatalities, 1);
  assert.equal(vanderpool.victimName, "Nicholas Vanderpool");
  assert.equal(vanderpool.victimAgeBand, "40\u201349");
  assert.equal(vanderpool.city, "San Jose");
  assert.equal(vanderpool.stateCode, "CA");
  assert.equal(vanderpool.region, "West");
  assert.equal(vanderpool.occurredOn, "2026-11-14");
  assert.equal(vanderpool.roadwayType, "San Felipe Road");
  assert.equal(vanderpool.vehicleType, "car");
  assert.equal(vanderpool.driverStatus, "at_scene");
  assert.match(vanderpool.summary, /Toyota Camry/);
  assert.match(vanderpool.summary, /Mousa Court/);
  assert.match(vanderpool.context, /East Bay Times page was not opened/);
  assert.equal(vanderpool.latitude, 37.30438);
  assert.equal(vanderpool.longitude, -121.77634);
  assert.equal(vanderpool.sourceName, "Hoodline");

  const publishedRows = [philadelphia, bangor, gorsuch, badertscher, amherst, andover, vanderpool];
  assert.equal(publishedRows.filter((row) => row.outcome === "killed").length, 4);
  assert.equal(publishedRows.filter((row) => row.outcome === "serious_injury").length, 3);
  assert.ok(publishedRows.every((row) => row.verified === true && row.reviewStatus === "published"));
  assert.ok(publishedRows.every((row) => row.ingestSource === "news" && row.datePrecision === "day"));
  assert.equal(selden.reviewStatus, "pending");
  assert.equal(arkadelphia.reviewStatus, "pending");
  assert.equal(news.filter((row) => row.victimName === "Christopher Gorsuch").length, 1);
  assert.equal(news.filter((row) => row.victimName === "Joseph Robert Badertscher").length, 1);
  assert.equal(news.filter((row) => row.victimName === "Nicholas Vanderpool").length, 1);
  assert.equal(news.filter((row) => row.city === "Philadelphia" && row.occurredOn === "2026-11-20").length, 1);
  assert.equal(news.filter((row) => row.city === "Philadelphia" && row.occurredOn === "2026-11-13").length, 1);
  assert.equal(news.filter((row) => row.city === "Long Beach" && row.occurredOn === "2026-10-26").length, 1);
  assert.equal(news.filter((row) => row.city === "Long Beach" && row.occurredOn.startsWith("2026-11")).length, 0);
  assert.equal(news.filter((row) => row.city === "Damariscotta" && row.occurredOn === "2026-11-04").length, 1);
  assert.equal(news.filter((row) => row.city === "Bremen").length, 0);
  assert.equal(news.filter((row) => row.city === "San Jose" && row.occurredOn === "2026-11-14").length, 1);

  const ids = new Set(news.map((row) => row.id));
  assert.equal(ids.size, news.length);
  const prepared = prepareImports(root);
  for (const row of [...publishedRows, selden, arkadelphia]) {
    assert.ok(
      prepared.news.some((item) => item.id === row.id),
      row.id,
    );
  }
});

test("Nov 22 2026 desk sweep publishes confirmed crashes and queues the unverified ones", () => {
  const news = JSON.parse(readFileSync(join(root, "data/crash-imports/news.json"), "utf8"));
  const byId = new Map(news.map((row) => [row.id, row]));

  const westchester = byId.get("news-58a1fec020cdce9a");
  assert.equal(westchester.reviewStatus, "published");
  assert.equal(westchester.verified, true);
  assert.equal(westchester.outcome, "killed");
  assert.equal(westchester.severity, "critical");
  assert.equal(westchester.fatalities, 1);
  assert.equal(westchester.injured, 0);
  assert.equal(westchester.victimName, null);
  assert.equal(westchester.city, "Westchester");
  assert.equal(westchester.stateCode, "CA");
  assert.equal(westchester.region, "West");
  assert.equal(westchester.occurredOn, "2026-11-20");
  assert.equal(westchester.datePrecision, "day");
  assert.equal(westchester.roadwayType, "South Pershing Drive");
  assert.equal(westchester.vehicleType, null);
  assert.equal(westchester.lighting, "daylight");
  assert.match(westchester.summary, /3:17 p\.m\./);
  assert.match(westchester.summary, /10400 block/);
  assert.match(westchester.summary, /not released/);
  assert.match(westchester.context, /3:15 p\.m\./);
  assert.equal(westchester.latitude, 33.94182);
  assert.equal(westchester.longitude, -118.4264);
  assert.equal(westchester.sourceName, "Los Angeles Fire Department");
  assert.equal(news[0].id, westchester.id);

  const thomas = byId.get("news-9594486ac54e4b77");
  assert.equal(thomas.reviewStatus, "published");
  assert.equal(thomas.verified, true);
  assert.equal(thomas.outcome, "killed");
  assert.equal(thomas.severity, "critical");
  assert.equal(thomas.fatalities, 1);
  assert.equal(thomas.injured, 0);
  assert.equal(thomas.victimName, "Taryn Thomas");
  assert.equal(thomas.victimAgeBand, "10\u201319");
  assert.equal(thomas.city, "Wyoming");
  assert.equal(thomas.stateCode, "MI");
  assert.equal(thomas.region, "Midwest");
  assert.equal(thomas.occurredOn, "2026-11-20");
  assert.equal(thomas.crashType, "right-hook");
  assert.equal(thomas.vehicleType, "bus");
  assert.equal(thomas.roadwayType, "36th Street");
  assert.match(thomas.summary, /e-bike|electric bicycle/);
  assert.match(thomas.summary, /Godwin Heights/);
  assert.match(thomas.summary, /2:45 p\.m\./);
  assert.match(thomas.context, /did not release her name/);
  assert.equal(thomas.latitude, 42.89867);
  assert.equal(thomas.longitude, -85.67025);
  assert.equal(thomas.sourceName, "WZZM");

  const harrisburg = byId.get("news-ac915ddd9a92b9ab");
  assert.equal(harrisburg.reviewStatus, "published");
  assert.equal(harrisburg.verified, true);
  assert.equal(harrisburg.outcome, "serious_injury");
  assert.equal(harrisburg.severity, "critical");
  assert.equal(harrisburg.injured, 1);
  assert.equal(harrisburg.fatalities, 0);
  assert.equal(harrisburg.victimName, null);
  assert.equal(harrisburg.city, "Harrisburg");
  assert.equal(harrisburg.stateCode, "PA");
  assert.equal(harrisburg.region, "Northeast");
  assert.equal(harrisburg.occurredOn, "2026-11-20");
  assert.equal(harrisburg.vehicleType, "car");
  assert.equal(harrisburg.roadwayType, "Maclay Street");
  assert.match(harrisburg.summary, /critical/);
  assert.match(harrisburg.summary, /Kyle Gautsch/);
  assert.match(harrisburg.summary, /700 block/);
  assert.match(harrisburg.context, /pedestrian/);
  assert.equal(harrisburg.latitude, 40.28114);
  assert.equal(harrisburg.longitude, -76.88825);
  assert.equal(harrisburg.sourceName, "WGAL");

  const providence = byId.get("news-ccef856e1f6d4e5a");
  assert.equal(providence.reviewStatus, "published");
  assert.equal(providence.verified, true);
  assert.equal(providence.outcome, "serious_injury");
  assert.equal(providence.severity, "high");
  assert.equal(providence.injured, 1);
  assert.equal(providence.victimName, null);
  assert.equal(providence.victimAgeBand, "10\u201319");
  assert.equal(providence.city, "Providence");
  assert.equal(providence.stateCode, "RI");
  assert.equal(providence.region, "Northeast");
  assert.equal(providence.occurredOn, "2026-11-20");
  assert.equal(providence.crashType, "intersection");
  assert.equal(providence.vehicleType, "minivan");
  assert.equal(providence.driverStatus, "charged");
  assert.match(providence.summary, /15-year-old/);
  assert.match(providence.summary, /Yesenia Morales/);
  assert.match(providence.summary, /femur/);
  assert.match(providence.summary, /8:15 a\.m\./);
  assert.equal(providence.latitude, 41.80984);
  assert.equal(providence.longitude, -71.43832);
  assert.equal(providence.sourceName, "WJAR");

  const homewood = byId.get("news-bf58e0d1bde78026");
  assert.equal(homewood.reviewStatus, "published");
  assert.equal(homewood.verified, true);
  assert.equal(homewood.outcome, "serious_injury");
  assert.equal(homewood.severity, "moderate");
  assert.equal(homewood.injured, 1);
  assert.equal(homewood.victimName, null);
  assert.equal(homewood.victimAgeBand, "10\u201319");
  assert.equal(homewood.city, "Homewood");
  assert.equal(homewood.stateCode, "AL");
  assert.equal(homewood.region, "South");
  assert.equal(homewood.occurredOn, "2026-11-20");
  assert.equal(homewood.vehicleType, "car");
  assert.equal(homewood.roadwayType, "Parkridge Drive");
  assert.match(homewood.summary, /10-year-old/);
  assert.match(homewood.summary, /life-threatening/);
  assert.match(homewood.context, /Patriot Park/);
  assert.equal(homewood.latitude, 33.47695);
  assert.equal(homewood.longitude, -86.79653);
  assert.equal(homewood.sourceName, "WBRC");

  const washington = byId.get("news-8436ed45dc7fe522");
  assert.equal(washington.reviewStatus, "pending");
  assert.equal(washington.verified, false);
  assert.equal(washington.outcome, "serious_injury");
  assert.equal(washington.severity, "critical");
  assert.equal(washington.city, "Washington");
  assert.equal(washington.stateCode, "DC");
  assert.equal(washington.region, "South");
  assert.equal(washington.occurredOn, "2026-11-20");
  assert.equal(washington.vehicleType, null);
  assert.match(washington.summary, /Wisconsin Avenue/);
  assert.match(washington.summary, /Quebec Street/);
  assert.match(washington.context, /no report confirmed that a motor vehicle was involved/i);
  assert.equal(washington.latitude, 38.93814);
  assert.equal(washington.longitude, -77.07426);
  assert.equal(washington.sourceName, "FOX 5 DC");

  const rockwood = byId.get("news-f107c1fe3926837e");
  assert.equal(rockwood.reviewStatus, "pending");
  assert.equal(rockwood.verified, false);
  assert.equal(rockwood.outcome, "serious_injury");
  assert.equal(rockwood.city, "Rockwood");
  assert.equal(rockwood.stateCode, "TN");
  assert.equal(rockwood.region, "South");
  assert.equal(rockwood.occurredOn, "2026-11-19");
  assert.equal(rockwood.victimAgeBand, "20\u201329");
  assert.match(rockwood.summary, /26-year-old/);
  assert.match(rockwood.summary, /Smokin Joe/);
  assert.match(rockwood.context, /injury is not stated/i);
  assert.match(rockwood.context, /O'Reilly/);
  assert.equal(rockwood.latitude, 35.87348);
  assert.equal(rockwood.longitude, -84.67697);
  assert.equal(rockwood.sourceName, "3B Media");

  const roseville = byId.get("news-efbf72d8cc1912b5");
  assert.equal(roseville.reviewStatus, "pending");
  assert.equal(roseville.verified, false);
  assert.equal(roseville.outcome, "serious_injury");
  assert.equal(roseville.city, "Roseville");
  assert.equal(roseville.stateCode, "CA");
  assert.equal(roseville.occurredOn, "2026-11-21");
  assert.equal(roseville.datePrecision, "published");
  assert.equal(roseville.latitude, null);
  assert.equal(roseville.longitude, null);
  assert.equal(roseville.victimAgeBand, "30\u201339");
  assert.match(roseville.summary, /30-year-old/);
  assert.match(roseville.context, /no motor vehicle is described/i);
  assert.equal(roseville.sourceName, "ABC10");

  const fallsChurch = byId.get("news-e38d3d84143dcb10");
  assert.equal(fallsChurch.victimName, "Nicholas Filbert");
  assert.equal(fallsChurch.victimAgeBand, "30\u201339");
  assert.equal(fallsChurch.reviewStatus, "published");
  assert.equal(fallsChurch.outcome, "killed");
  assert.equal(fallsChurch.occurredOn, "2026-11-16");
  assert.match(fallsChurch.summary, /Nicholas Filbert/);
  assert.match(fallsChurch.context, /Nov\. 20, 2026/);

  const publishedRows = [westchester, thomas, harrisburg, providence, homewood];
  assert.equal(publishedRows.filter((row) => row.outcome === "killed").length, 2);
  assert.equal(publishedRows.filter((row) => row.outcome === "serious_injury").length, 3);
  assert.ok(publishedRows.every((row) => row.verified === true && row.reviewStatus === "published"));
  assert.ok(publishedRows.every((row) => row.ingestSource === "news" && row.datePrecision === "day"));
  assert.equal(washington.reviewStatus, "pending");
  assert.equal(rockwood.reviewStatus, "pending");
  assert.equal(roseville.reviewStatus, "pending");
  assert.equal(news.filter((row) => row.victimName === "Taryn Thomas").length, 1);
  assert.equal(news.filter((row) => row.victimName === "Nicholas Filbert").length, 1);
  assert.equal(news.filter((row) => row.city === "Westchester" && row.occurredOn === "2026-11-20").length, 1);
  assert.equal(news.filter((row) => row.city === "Wyoming" && row.occurredOn === "2026-11-20").length, 1);
  assert.equal(news.filter((row) => row.city === "Harrisburg" && row.occurredOn === "2026-11-20").length, 1);
  assert.equal(news.filter((row) => row.city === "Providence" && row.occurredOn === "2026-11-20").length, 1);
  assert.equal(news.filter((row) => row.city === "Homewood").length, 1);
  assert.equal(news.filter((row) => row.city === "Rockwood").length, 1);
  assert.equal(news.filter((row) => row.city === "Roseville").length, 1);
  assert.equal(news.filter((row) => row.city === "Covington" && row.occurredOn === "2026-11-18").length, 1);
  assert.equal(news.filter((row) => row.city === "Panama City Beach" && row.occurredOn === "2026-11-18").length, 1);
  assert.equal(news.filter((row) => row.city === "East Falls Church" && row.occurredOn === "2026-11-16").length, 1);
  assert.equal(news.filter((row) => row.city === "Leesburg" && row.occurredOn === "2026-11-10").length, 1);
  assert.equal(news.filter((row) => row.city === "Leesburg" && row.victimName === "Nicholas Filbert").length, 0);
  assert.equal(news.filter((row) => row.city === "Laguna Beach").length, 0);

  const ids = new Set(news.map((row) => row.id));
  assert.equal(ids.size, news.length);
  const prepared = prepareImports(root);
  for (const row of [...publishedRows, washington, rockwood, roseville, fallsChurch]) {
    assert.ok(
      prepared.news.some((item) => item.id === row.id),
      row.id,
    );
  }
});
