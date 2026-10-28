/**
 * Overlap rules for bulk crash imports.
 *
 * Curated filings win: one curated crash suppresses the closest official row
 * that is the same state and the same day (FARS) or the same month inside a
 * short distance (PennDOT, which has no calendar day).
 * A PennDOT bicyclist death is suppressed when a FARS case in that month sits
 * on the same spot, so Pennsylvania deaths are not counted twice.
 * News is suppressed only on a reported crash date plus place, or on a
 * matching victim name. A publication date alone does not drop a story.
 */

const PLACE_STOP = new Set([
  "county",
  "city",
  "town",
  "township",
  "borough",
  "village",
  "parish",
  "state",
  "north",
  "south",
  "east",
  "west",
  "fort",
  "saint",
  "mount",
]);

export function haversineKm(lat1, lon1, lat2, lon2) {
  if (![lat1, lon1, lat2, lon2].every((n) => Number.isFinite(n))) return Infinity;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function dayDiff(a, b) {
  const da = Date.parse(`${String(a).slice(0, 10)}T00:00:00Z`);
  const db = Date.parse(`${String(b).slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(da) || !Number.isFinite(db)) return Infinity;
  return Math.abs(da - db) / 86_400_000;
}

function tokens(value) {
  return String(value || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 4 && !PLACE_STOP.has(word));
}

export function placeOverlap(a, b) {
  const right = new Set(tokens(b));
  return tokens(a).some((word) => right.has(word));
}

/** Pull curated anchors out of src/lib/crashes-seed.ts without loading TypeScript. */
export function parseCuratedSeed(source) {
  const chunks = source.split(/\n {2}\{/);
  const rows = [];
  for (const chunk of chunks) {
    const id = /id:\s*"([^"]+)"/.exec(chunk)?.[1];
    const occurredOn = /occurredOn:\s*"([^"]+)"/.exec(chunk)?.[1];
    const stateCode = /stateCode:\s*"([^"]+)"/.exec(chunk)?.[1];
    const city = /city:\s*"([^"]+)"/.exec(chunk)?.[1];
    const lat = /latitude:\s*(-?\d+(?:\.\d+)?)/.exec(chunk)?.[1];
    const lon = /longitude:\s*(-?\d+(?:\.\d+)?)/.exec(chunk)?.[1];
    const victimName = /victimName:\s*"([^"]+)"/.exec(chunk)?.[1] ?? null;
    if (!id || !occurredOn || !stateCode) continue;
    rows.push({
      id,
      occurredOn,
      stateCode,
      city: city ?? "",
      latitude: lat == null ? null : Number(lat),
      longitude: lon == null ? null : Number(lon),
      victimName,
      datePrecision: "day",
      ingestSource: "curated",
    });
  }
  return rows;
}

function curatedScore(row, anchor) {
  if (row.stateCode !== anchor.stateCode) return null;
  const monthPrecision = row.datePrecision === "month";
  if (monthPrecision) {
    if (String(row.occurredOn).slice(0, 7) !== String(anchor.occurredOn).slice(0, 7)) return null;
  } else if (dayDiff(row.occurredOn, anchor.occurredOn) > 1) {
    return null;
  }
  const distance = haversineKm(row.latitude, row.longitude, anchor.latitude, anchor.longitude);
  const places = placeOverlap(row.city, anchor.city) || placeOverlap(row.locationName, anchor.city);
  const limit = monthPrecision ? 8 : 30;
  if (distance <= limit) return distance;
  if (places && (monthPrecision || dayDiff(row.occurredOn, anchor.occurredOn) <= 1)) {
    return distance === Infinity ? 50 : distance;
  }
  return null;
}

/** Drop the closest bulk row for each curated anchor. Curated rows themselves stay. */
export function suppressCuratedOverlaps(rows, anchors) {
  const drop = new Set();
  for (const anchor of anchors) {
    let best = null;
    rows.forEach((row, index) => {
      if (drop.has(index) || row.ingestSource === "curated") return;
      const score = curatedScore(row, anchor);
      if (score == null) return;
      if (!best || score < best.score) best = { index, score };
    });
    if (best) drop.add(best.index);
  }
  return {
    rows: rows.filter((_, index) => !drop.has(index)),
    suppressed: drop.size,
  };
}

/**
 * Drop a PennDOT death when one FARS case that month is within 8 km.
 * Each FARS case (police report id + year) can suppress only one PennDOT crash.
 */
export function suppressPenndotDeathsCoveredByFars(penndot, fars) {
  const cases = [];
  const seen = new Set();
  for (const row of fars) {
    if (row.stateCode !== "PA" || !(row.fatalities > 0)) continue;
    const key = `${row.policeReportId}|${String(row.occurredOn).slice(0, 4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    cases.push({ key, row });
  }
  const pairs = [];
  penndot.forEach((row, index) => {
    if (!(row.fatalities > 0)) return;
    for (const item of cases) {
      if (String(row.occurredOn).slice(0, 7) !== String(item.row.occurredOn).slice(0, 7)) continue;
      const distance = haversineKm(row.latitude, row.longitude, item.row.latitude, item.row.longitude);
      const samePlace =
        distance <= 8 ||
        (distance === Infinity &&
          (placeOverlap(row.city, item.row.city) || placeOverlap(row.locationName, item.row.locationName)));
      if (!samePlace) continue;
      pairs.push({ index, key: item.key, distance: distance === Infinity ? 100 : distance });
    }
  });
  pairs.sort((a, b) => a.distance - b.distance);
  const drop = new Set();
  const usedCases = new Set();
  for (const pair of pairs) {
    if (drop.has(pair.index) || usedCases.has(pair.key)) continue;
    drop.add(pair.index);
    usedCases.add(pair.key);
  }
  return {
    rows: penndot.filter((_, index) => !drop.has(index)),
    suppressed: drop.size,
  };
}

function newsMatchesOfficial(news, row) {
  if (news.stateCode !== row.stateCode) return false;
  const named =
    news.victimName &&
    row.victimName &&
    news.victimName.trim().toLowerCase() === row.victimName.trim().toLowerCase();
  if (named) return true;
  if (news.datePrecision !== "day") return false;
  if (dayDiff(news.occurredOn, row.occurredOn) > 1 && row.datePrecision === "day") return false;
  if (row.datePrecision === "month") {
    if (String(news.occurredOn).slice(0, 7) !== String(row.occurredOn).slice(0, 7)) return false;
  } else if (dayDiff(news.occurredOn, row.occurredOn) > 1) {
    return false;
  }
  const distance = haversineKm(news.latitude, news.longitude, row.latitude, row.longitude);
  if (distance <= 15) return true;
  return placeOverlap(news.city, row.city) || placeOverlap(news.locationName, row.locationName);
}

export function suppressNewsOverlaps(news, official) {
  const rows = [];
  let suppressed = 0;
  for (const item of news) {
    if (official.some((row) => newsMatchesOfficial(item, row))) suppressed += 1;
    else rows.push(item);
  }
  return { rows, suppressed };
}
