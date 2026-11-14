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
  assert.equal(news[0].id, hanover.id);

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
  assert.equal(germantown.reviewStatus, "pending");
  assert.equal(germantown.verified, false);
  assert.equal(germantown.outcome, "killed");
  assert.equal(germantown.severity, "critical");
  assert.equal(germantown.fatalities, 1);
  assert.equal(germantown.injured, 0);
  assert.equal(germantown.victimName, "Dysheir M. McFadden");
  assert.equal(germantown.victimAgeBand, "20\u201329");
  assert.equal(germantown.crashType, "hit-and-run");
  assert.equal(germantown.driverStatus, "fled");
  assert.equal(germantown.vehicleType, "car");
  assert.equal(germantown.city, "Philadelphia");
  assert.equal(germantown.stateCode, "PA");
  assert.equal(germantown.occurredOn, "2026-11-13");
  assert.equal(germantown.lighting, "dark");
  assert.match(germantown.summary, /Chelten Avenue/);
  assert.match(germantown.summary, /1:02/);
  assert.match(germantown.context, /Not confirmed as a bicycle/);
  assert.match(germantown.context, /electric dirt bike/);
  assert.equal(germantown.latitude, 40.03838);
  assert.equal(germantown.longitude, -75.17213);

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

  const published = [hanover, osage];
  assert.equal(published.filter((row) => row.outcome === "killed").length, 0);
  assert.equal(published.filter((row) => row.outcome === "serious_injury").length, 2);
  assert.ok(published.every((row) => row.verified === true && row.reviewStatus === "published"));
  assert.ok(published.every((row) => row.ingestSource === "news" && row.datePrecision === "day"));
  assert.equal(germantown.reviewStatus, "pending");
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
