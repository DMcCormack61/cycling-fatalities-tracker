#!/usr/bin/env node
/**
 * Pull US headlines about cyclists killed or injured and store them as
 * unverified news candidates.
 *
 * Sources: GDELT DOC 2.0 art list and Google News RSS. Extraction uses the
 * headline only (scripts/news-extract.mjs). Stories that do not state a US
 * place and an outcome are dropped. Existing promoted or rejected rows are kept.
 *
 * Refresh:
 *   node scripts/fetch-news-crashes.mjs
 *   node scripts/load-crash-imports.mjs
 *
 * A dated window reads Google News RSS only and merges new rows into the
 * file. Published and rejected rows stay. Pending rows already on disk stay.
 *   node scripts/fetch-news-crashes.mjs --after 2026-10-25 --before 2026-11-01
 */
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { articleId, extractCandidate } from "./news-extract.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "data", "crash-imports", "news.json");
const MANIFEST = join(ROOT, "data", "crash-imports", "manifest.json");
const UA = "cycling-fatalities-tracker/news";
const PENDING_CAP = 250;

const QUERIES = [
  '"cyclist killed"',
  '"bicyclist killed"',
  '"bicyclist struck"',
  '"bicycle crash" injured',
  '"cyclist injured"',
];

async function getText(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json, application/rss+xml, text/xml, */*" },
  });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.text();
}

async function gdelt(query) {
  const url = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
  url.searchParams.set("query", `${query} sourcecountry:US sourcelang:english`);
  url.searchParams.set("mode", "ArtList");
  url.searchParams.set("maxrecords", "75");
  url.searchParams.set("format", "json");
  url.searchParams.set("timespan", "12months");
  let text = "";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
    });
    if (response.status === 429) {
      await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
      continue;
    }
    if (!response.ok) throw new Error(`${response.status} ${url}`);
    text = await response.text();
    break;
  }
  if (!text) return [];
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return [];
  }
  const articles = data?.articles || [];
  return articles.map((article) => ({
    title: article.title,
    url: article.url,
    publishedOn: gdeltDate(article.seendate),
    sourceName: article.domain || "GDELT",
  }));
}

function gdeltDate(value) {
  const match = /^(\d{4})(\d{2})(\d{2})/.exec(String(value || ""));
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function argValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  const value = process.argv[index + 1];
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${flag} needs a YYYY-MM-DD value`);
  }
  return value;
}

function dayBefore(iso) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

async function googleNews(query, { after, before } = {}) {
  const clause = after && before ? `after:${dayBefore(after)} before:${before}` : "when:365d";
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(`${query} ${clause}`)}&hl=en-US&gl=US&ceid=US:en`;
  const xml = await getText(url);
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
  return items.map((item) => {
    const block = item[1];
    const title = decode(tag(block, "title"));
    const link = decode(tag(block, "link"));
    const pub = tag(block, "pubDate");
    const source = decode(tag(block, "source")) || titleSource(title);
    return { title, url: link, publishedOn: rssDate(pub), sourceName: source || "Google News" };
  });
}

function tag(block, name) {
  const match = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(block);
  return match ? match[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim() : "";
}

function decode(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function titleSource(title) {
  const match = / - ([^-]+)$/.exec(title);
  return match ? match[1].trim() : "";
}

function rssDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function readJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf8"));
}

async function main() {
  const after = argValue("--after");
  const before = argValue("--before");
  const windowed = Boolean(after && before);
  if (Boolean(after) !== Boolean(before)) {
    throw new Error("Pass both --after and --before, or neither.");
  }
  const fetched = [];
  for (const query of QUERIES) {
    if (!windowed) {
      try {
        const rows = await gdelt(query);
        console.log(`[news] gdelt ${query}: ${rows.length}`);
        fetched.push(...rows);
      } catch (err) {
        console.error(`[news] gdelt failed for ${query}: ${err.message}`);
      }
    }
    try {
      const rows = await googleNews(query, { after, before });
      console.log(`[news] google news ${query}: ${rows.length}`);
      fetched.push(...rows);
    } catch (err) {
      console.error(`[news] google news failed for ${query}: ${err.message}`);
    }
  }
  if (windowed) console.log(`[news] google news window ${after} through the day before ${before}`);

  const candidates = [];
  const seenUrl = new Set();
  for (const item of fetched) {
    if (!item.url || seenUrl.has(item.url)) continue;
    seenUrl.add(item.url);
    if (windowed) {
      const publishedOn = item.publishedOn;
      if (!publishedOn || publishedOn < after || publishedOn >= before) continue;
    }
    const extracted = extractCandidate(item);
    if (!extracted) continue;
    candidates.push({ ...extracted, id: articleId(item.url) });
  }

  const existing = readJson(OUT, []);
  const locked = new Map(
    existing
      .filter((row) => row.reviewStatus === "published" || row.reviewStatus === "rejected")
      .map((row) => [row.id, row]),
  );
  const pending = [];
  const seenId = new Set(locked.keys());
  if (windowed) {
    for (const row of existing) {
      if (row.reviewStatus !== "pending" || seenId.has(row.id)) continue;
      seenId.add(row.id);
      pending.push(row);
    }
  }
  for (const row of candidates.sort((a, b) => b.occurredOn.localeCompare(a.occurredOn))) {
    if (seenId.has(row.id)) continue;
    seenId.add(row.id);
    pending.push(row);
    if (!windowed && pending.length >= PENDING_CAP) break;
  }
  const rows = [...locked.values(), ...pending].sort((a, b) =>
    b.occurredOn.localeCompare(a.occurredOn) || a.id.localeCompare(b.id),
  );

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(rows));
  const manifest = readJson(MANIFEST, {});
  manifest.news = {
    file: "data/crash-imports/news.json",
    rows: rows.length,
    pending: rows.filter((row) => row.reviewStatus === "pending").length,
    published: rows.filter((row) => row.reviewStatus === "published").length,
    rejected: rows.filter((row) => row.reviewStatus === "rejected").length,
    verified: false,
    cap: PENDING_CAP,
    queries: QUERIES,
    note: "Headline extraction only. Pending rows stay out of desk totals until promote-news-crash.mjs.",
    refresh: "node scripts/fetch-news-crashes.mjs && node scripts/load-crash-imports.mjs",
  };
  writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`[news] wrote ${rows.length} rows (${manifest.news.pending} pending) to ${OUT}`);
  if (rows.length === 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error("[news] failed:", err);
  process.exit(1);
});
