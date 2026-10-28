#!/usr/bin/env node
/**
 * Load data/crash-imports into crashes.
 *
 * FARS and PennDOT replace previous rows from those sources.
 * Curated seed rows are never overwritten. A curated filing suppresses the
 * overlapping bulk row. PennDOT deaths that sit on a FARS case are dropped.
 * News inserts stay unverified. A promoted news row (review_status published)
 * is not returned to the queue.
 *
 *   node scripts/load-crash-imports.mjs            # DATABASE_URL, or dry counts
 *   node scripts/load-crash-imports.mjs --dry-run  # counts only
 */
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import pg from "pg";
import {
  parseCuratedSeed,
  suppressCuratedOverlaps,
  suppressNewsOverlaps,
  suppressPenndotDeathsCoveredByFars,
} from "./crash-dedupe.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const COLUMNS = [
  "id",
  "title",
  "location_name",
  "occurred_on",
  "country",
  "country_code",
  "state",
  "state_code",
  "city",
  "region",
  "latitude",
  "longitude",
  "crash_type",
  "outcome",
  "severity",
  "fatalities",
  "injured",
  "victim_name",
  "victim_age_band",
  "driver_status",
  "vehicle_type",
  "roadway_type",
  "lighting",
  "helmet",
  "police_report_id",
  "summary",
  "context",
  "source_name",
  "source_url",
  "verified",
  "location_precision",
  "ingest_source",
  "review_status",
];

export function prepareImports(root = ROOT) {
  const dir = join(root, "data", "crash-imports");
  const read = (name) => {
    const path = join(dir, name);
    if (!existsSync(path)) return [];
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  };
  const seedPath = join(root, "src", "lib", "crashes-seed.ts");
  const anchors = existsSync(seedPath) ? parseCuratedSeed(readFileSync(seedPath, "utf8")) : [];
  const anchorIds = new Set(anchors.map((row) => row.id));
  let fars = read("fars.json").filter((row) => !anchorIds.has(row.id));
  let penndot = read("penndot.json").filter((row) => !anchorIds.has(row.id));
  let news = read("news.json").filter(
    (row) => row.reviewStatus !== "rejected" && !anchorIds.has(row.id),
  );
  const farsCurated = suppressCuratedOverlaps(fars, anchors);
  fars = farsCurated.rows;
  const penndotCurated = suppressCuratedOverlaps(penndot, anchors);
  penndot = penndotCurated.rows;
  const penndotFars = suppressPenndotDeathsCoveredByFars(penndot, fars);
  penndot = penndotFars.rows;
  const newsDrop = suppressNewsOverlaps(news, [...anchors, ...fars, ...penndot]);
  news = newsDrop.rows;
  return {
    fars,
    penndot,
    news,
    anchors: anchors.length,
    suppressed: {
      farsCurated: farsCurated.suppressed,
      penndotCurated: penndotCurated.suppressed,
      penndotFars: penndotFars.suppressed,
      news: newsDrop.suppressed,
    },
  };
}

function valuesOf(row) {
  return [
    row.id,
    row.title,
    row.locationName,
    String(row.occurredOn).slice(0, 10),
    row.country || "United States",
    row.countryCode || "USA",
    row.state,
    row.stateCode,
    row.city,
    row.region,
    row.latitude ?? null,
    row.longitude ?? null,
    row.crashType || "other",
    row.outcome,
    row.severity,
    row.fatalities ?? 0,
    row.injured ?? 0,
    row.victimName ?? null,
    row.victimAgeBand ?? null,
    row.driverStatus ?? null,
    row.vehicleType ?? null,
    row.roadwayType ?? null,
    row.lighting ?? null,
    row.helmet ?? null,
    row.policeReportId ?? null,
    row.summary,
    row.context ?? null,
    row.sourceName,
    row.sourceUrl ?? null,
    Boolean(row.verified),
    row.locationPrecision ?? null,
    row.ingestSource,
    row.reviewStatus || (row.verified ? "published" : "pending"),
  ];
}

async function insertRows(query, rows) {
  const size = 80;
  for (let offset = 0; offset < rows.length; offset += size) {
    const chunk = rows.slice(offset, offset + size);
    const params = [];
    const sqlTuples = chunk.map((row) => {
      const holders = valuesOf(row).map((value, column) => {
        params.push(value);
        const marker = `$${params.length}`;
        return COLUMNS[column] === "occurred_on" ? `${marker}::date` : marker;
      });
      return `(${holders.join(", ")})`;
    });
    const updates = COLUMNS.filter((column) => column !== "id")
      .map((column) => `${column} = excluded.${column}`)
      .join(", ");
    await query(
      `insert into crashes (${COLUMNS.join(", ")}) values ${sqlTuples.join(", ")}
       on conflict (id) do update set ${updates}
       where crashes.ingest_source is distinct from 'curated'
         and not (
           crashes.ingest_source = 'news'
           and crashes.review_status = 'published'
           and excluded.review_status = 'pending'
         )`,
      params,
    );
  }
}

export async function loadCrashImports(query, { root = ROOT, force = false } = {}) {
  if (!existsSync(join(root, "data", "crash-imports"))) {
    return { skipped: true, reason: "no import directory" };
  }
  const hash = bundleHashFrom(root);
  await query(
    `create table if not exists _crash_imports (
      name text primary key,
      content_hash text not null,
      row_count integer not null,
      loaded_at timestamptz not null default now()
    )`,
  );
  if (!force) {
    const existing = await query(`select content_hash from _crash_imports where name = 'bundle'`);
    if (existing[0]?.content_hash === hash) {
      return { skipped: true, reason: "hash unchanged", hash };
    }
  }
  const prepared = prepareImports(root);
  await query("begin");
  try {
    await query(`delete from crashes where ingest_source in ('fars', 'penndot')`);
    await insertRows(query, prepared.fars);
    await insertRows(query, prepared.penndot);
    await query(
      `delete from crashes where ingest_source = 'news' and review_status = 'pending'`,
    );
    await insertRows(query, prepared.news);
    const rowCount = prepared.fars.length + prepared.penndot.length + prepared.news.length;
    await query(
      `insert into _crash_imports (name, content_hash, row_count)
       values ('bundle', $1, $2)
       on conflict (name) do update set
         content_hash = excluded.content_hash,
         row_count = excluded.row_count,
         loaded_at = now()`,
      [hash, rowCount],
    );
    await query("commit");
    return {
      skipped: false,
      hash,
      fars: prepared.fars.length,
      penndot: prepared.penndot.length,
      news: prepared.news.length,
      suppressed: prepared.suppressed,
    };
  } catch (err) {
    try {
      await query("rollback");
    } catch {
      /* keep the original error */
    }
    throw err;
  }
}

function bundleHashFrom(root) {
  const hash = createHash("sha256");
  for (const name of ["fars.json", "penndot.json", "news.json"]) {
    const path = join(root, "data", "crash-imports", name);
    hash.update(name);
    hash.update(existsSync(path) ? readFileSync(path) : "");
  }
  return hash.digest("hex");
}

async function main() {
  const dry = process.argv.includes("--dry-run") || !process.env.DATABASE_URL;
  const prepared = prepareImports(ROOT);
  const summary = {
    fars: prepared.fars.length,
    penndot: prepared.penndot.length,
    news: prepared.news.length,
    newsPending: prepared.news.filter((row) => row.reviewStatus === "pending").length,
    curatedAnchors: prepared.anchors,
    suppressed: prepared.suppressed,
  };
  console.log(JSON.stringify(summary, null, 2));
  if (dry) {
    if (!process.env.DATABASE_URL) {
      console.log("[import] DATABASE_URL not set — counts only. PGLite loads this file on startup.");
    }
    return;
  }
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const client = await pool.connect();
  try {
    const result = await loadCrashImports(
      async (text, params = []) => (await client.query(text, params)).rows,
      { root: ROOT, force: process.argv.includes("--force") },
    );
    console.log("[import] loaded", result);
  } finally {
    client.release();
    await pool.end();
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((err) => {
    console.error("[import] failed:", err);
    process.exit(1);
  });
}
