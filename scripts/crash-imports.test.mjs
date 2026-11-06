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
  assert.equal(columbus.victimName, null);
  assert.equal(columbus.occurredOn, "2026-11-05");
  assert.equal(columbus.city, "Columbus");
  assert.equal(columbus.stateCode, "OH");
  assert.equal(columbus.crashType, "intersection");
  assert.equal(columbus.driverStatus, "at_scene");
  assert.equal(columbus.lighting, "dark");
  assert.match(columbus.summary, /Kenny Road/);
  assert.match(columbus.summary, /7:37/);
  assert.equal(columbus.latitude, 40.00665);
  assert.equal(news[0].id, columbus.id);

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
  assert.equal(battleCreek.victimName, null);
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
