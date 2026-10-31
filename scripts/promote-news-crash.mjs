#!/usr/bin/env node
/**
 * Promote or reject one news candidate.
 *
 *   node scripts/promote-news-crash.mjs news-abc123
 *   node scripts/promote-news-crash.mjs news-abc123 --reject
 *
 * Updates data/crash-imports/news.json so the next load (and PGLite startup)
 * keeps the decision. When DATABASE_URL is set, the live row is updated too.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FILE = join(ROOT, "data", "crash-imports", "news.json");
const id = process.argv.find((arg) => arg.startsWith("news-"));
const reject = process.argv.includes("--reject");

if (!id) {
  console.error("Usage: node scripts/promote-news-crash.mjs <news-id> [--reject]");
  process.exit(1);
}
if (!existsSync(FILE)) {
  console.error(`[promote] missing ${FILE}. Run node scripts/fetch-news-crashes.mjs first.`);
  process.exit(1);
}

const rows = JSON.parse(readFileSync(FILE, "utf8"));
const row = rows.find((item) => item.id === id);
if (!row) {
  console.error(`[promote] ${id} is not in the news file`);
  process.exit(1);
}
if (reject) {
  row.reviewStatus = "rejected";
  row.verified = false;
} else {
  row.reviewStatus = "published";
  row.verified = true;
  const boilerplate = !row.context || row.context.startsWith("Unreviewed news candidate");
  if (boilerplate) {
    row.context = row.victimName
      ? "Promoted from the news queue. The name was taken from the report."
      : "Promoted from the news queue. The report did not name the victim.";
  }
}
writeFileSync(FILE, JSON.stringify(rows));
console.log(`[promote] ${id} -> ${row.reviewStatus} in ${FILE}`);

if (!process.env.DATABASE_URL) {
  console.log("[promote] DATABASE_URL not set. PGLite picks this up the next time the app starts.");
  process.exit(0);
}

const { default: pg } = await import("pg");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
try {
  await pool.query(
    `update crashes
     set verified = $2, review_status = $3, context = $4
     where id = $1 and ingest_source = 'news'`,
    [id, row.verified, row.reviewStatus, row.context],
  );
  console.log("[promote] updated the database row");
} finally {
  await pool.end();
}
