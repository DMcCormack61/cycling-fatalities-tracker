import { normalizePlaceName } from "@/lib/country-centroids";
import type { Sql } from "@/lib/db";
import { finiteCoord, realCoords } from "@/lib/crash-place";

type TownPoint = { latitude: number; longitude: number };

const USER_AGENT = "CyclingFatalityTracker/0.1 (local preview; contact repo owner)";

type NominatimHit = {
  lat?: string;
  lon?: string;
  boundingbox?: string[];
  type?: string;
  addresstype?: string;
};

const globalRef = globalThis as typeof globalThis & {
  __nominatimTail?: Promise<unknown>;
};

function cacheKey(city: string, country: string): string {
  return `${normalizePlaceName(city)}|${normalizePlaceName(country)}`;
}

function acceptHit(hit: NominatimHit): TownPoint | null {
  const point = realCoords(finiteCoord(hit.lat), finiteCoord(hit.lon));
  if (!point) return null;
  const kind = `${hit.type ?? ""} ${hit.addresstype ?? ""}`.toLowerCase();
  if (/\bcountry\b/.test(kind)) return null;
  const { latitude, longitude } = point;
  const box = hit.boundingbox;
  if (box && box.length >= 4) {
    const south = Number(box[0]);
    const north = Number(box[1]);
    const west = Number(box[2]);
    const east = Number(box[3]);
    if ([south, north, west, east].every(Number.isFinite)) {
      if (Math.abs(north - south) > 4 || Math.abs(east - west) > 4) return null;
    }
  }
  return { latitude, longitude };
}

async function readCache(sql: Sql, key: string): Promise<TownPoint | null> {
  const rows = await sql<{ latitude: number; longitude: number }>`
    select latitude, longitude from place_geocode_cache where cache_key = ${key} limit 1
  `;
  const row = rows[0];
  if (!row) return null;
  return realCoords(finiteCoord(row.latitude), finiteCoord(row.longitude));
}

async function writeCache(sql: Sql, key: string, point: TownPoint): Promise<void> {
  await sql`
    insert into place_geocode_cache (cache_key, latitude, longitude)
    values (${key}, ${point.latitude}, ${point.longitude})
    on conflict (cache_key) do nothing
  `;
}

async function nominatimTown(city: string, country: string): Promise<TownPoint | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("q", `${city}, ${country}`);
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Language": "en",
      "User-Agent": USER_AGENT,
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return null;
  const body = (await response.json()) as unknown;
  if (!Array.isArray(body) || body.length === 0) return null;
  return acceptHit(body[0] as NominatimHit);
}

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const prev = globalRef.__nominatimTail ?? Promise.resolve();
  const run = prev
    .catch(() => undefined)
    .then(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1100));
      return task();
    });
  globalRef.__nominatimTail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/**
 * One Nominatim lookup per city/country, cached in Postgres.
 * Nominatim's usage policy requires a User-Agent and at most one request per second.
 * Page views after the first read the cache and do not call out.
 */
export async function lookupTown(
  sql: Sql,
  city: string,
  country: string,
): Promise<TownPoint | null> {
  const key = cacheKey(city, country);
  if (!key || key === "|") return null;
  const cached = await readCache(sql, key);
  if (cached) return cached;

  try {
    return await enqueue(async () => {
      const again = await readCache(sql, key);
      if (again) return again;
      const hit = await nominatimTown(city, country);
      if (!hit) return null;
      await writeCache(sql, key, hit);
      return hit;
    });
  } catch (err) {
    console.error("[place-geocode] town lookup failed:", err);
    return null;
  }
}
