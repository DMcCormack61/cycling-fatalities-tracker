import { lookupCountry, normalizePlaceName } from "@/lib/country-centroids";
import type { LocationPrecision } from "@/lib/crashes";
import { CRASH_SEED } from "@/lib/crashes-seed";

/** Street / neighborhood view when the filing has a site coordinate. */
export const SITE_ZOOM = 14;
/** Town or district view for an approximate pin. */
export const TOWN_ZOOM = 12;

export type CrashMapScope = "site" | "town" | "country";

export type CrashMapPlace = {
  latitude: number;
  longitude: number;
  zoom: number;
  showMarker: boolean;
  approximate: boolean;
  scope: CrashMapScope;
};

export type SyncResolution = {
  place: CrashMapPlace | null;
  /** Set when a town name is present but not in the static index. */
  geocode: { city: string; country: string } | null;
};

export type PlaceSource = {
  city?: string | null;
  country?: string | null;
  context?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  approxLatitude?: number | null;
  approxLongitude?: number | null;
  approxZoom?: number | null;
  locationPrecision?: LocationPrecision | null;
};

const PLACEHOLDER = new Set([
  "unknown",
  "n a",
  "na",
  "none",
  "unspecified",
  "various",
  "multiple",
  "nationwide",
  "national",
  "tbd",
  "not reported",
  "undisclosed",
  "null",
]);

export function finiteCoord(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Real coordinates. Exact 0,0 is treated as unfiled (Gulf of Guinea sentinel). */
export function realCoords(
  latitude: number | null,
  longitude: number | null,
): { latitude: number; longitude: number } | null {
  if (latitude == null || longitude == null) return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  if (latitude === 0 && longitude === 0) return null;
  return { latitude, longitude };
}

export function usableName(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const norm = normalizePlaceName(trimmed);
  if (!norm || PLACEHOLDER.has(norm)) return null;
  return trimmed;
}

/**
 * Some filings store a Nominatim town, district, or locality pin and say so in
 * `context`. Those are not the crash site, so the map is labeled approximate.
 * An explicit `locationPrecision` on the row overrides this.
 */
export function contextMarksInexact(context: string | null | undefined): boolean {
  if (!context) return false;
  const t = context.toLowerCase();
  if (t.includes("not the crash site")) return true;
  if (t.includes("no exact site pin")) return true;
  if (t.includes("did not resolve a exact site")) return true;
  if (t.includes("returned no exact site pin")) return true;
  if (t.includes("suburb-level")) return true;
  if (t.includes("village-level")) return true;
  if (t.includes("county pin")) return true;
  if (t.includes("administrative pin")) return true;
  if (t.includes("city pin")) return true;
  if (t.includes("locality pin")) return true;
  if (t.includes("cdp (nominatim)")) return true;
  return false;
}

type CityHit = { latitude: number; longitude: number };

function buildCityIndex(): Map<string, CityHit> {
  const groups = new Map<string, { lat: number; lng: number }[]>();
  for (const row of CRASH_SEED) {
    const city = usableName(row.city);
    const country = usableName(row.country);
    const point = realCoords(finiteCoord(row.latitude), finiteCoord(row.longitude));
    if (!city || !country || !point) continue;
    if (normalizePlaceName(city) === normalizePlaceName(country)) continue;
    const key = `${normalizePlaceName(city)}|${normalizePlaceName(country)}`;
    const list = groups.get(key) ?? [];
    list.push({ lat: point.latitude, lng: point.longitude });
    groups.set(key, list);
  }

  const index = new Map<string, CityHit>();
  for (const [key, points] of groups) {
    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;
    let sumLat = 0;
    let sumLng = 0;
    for (const p of points) {
      minLat = Math.min(minLat, p.lat);
      maxLat = Math.max(maxLat, p.lat);
      minLng = Math.min(minLng, p.lng);
      maxLng = Math.max(maxLng, p.lng);
      sumLat += p.lat;
      sumLng += p.lng;
    }
    // Skip names that span distant places (several Springfields in one country).
    if (maxLat - minLat > 0.75 || maxLng - minLng > 0.75) continue;
    index.set(key, {
      latitude: sumLat / points.length,
      longitude: sumLng / points.length,
    });
  }
  return index;
}

const CITY_INDEX = buildCityIndex();

function clampZoom(value: number | null | undefined, fallback: number): number {
  if (value == null || !Number.isFinite(value)) return fallback;
  return Math.min(18, Math.max(2, Math.round(value)));
}

function countryView(
  latitude: number,
  longitude: number,
  zoom: number | null | undefined,
): CrashMapPlace {
  const requested = zoom == null ? 5 : clampZoom(zoom, 5);
  const countryZoom = requested >= 5 && requested <= 6 ? requested : 5;
  return {
    latitude,
    longitude,
    zoom: countryZoom,
    showMarker: false,
    approximate: true,
    scope: "country",
  };
}

function countryFromName(country: string): CrashMapPlace | null {
  const hit = lookupCountry(country);
  if (!hit) return null;
  return {
    latitude: hit.latitude,
    longitude: hit.longitude,
    zoom: hit.zoom,
    showMarker: false,
    approximate: true,
    scope: "country",
  };
}

function none(place: CrashMapPlace | null): SyncResolution {
  return { place, geocode: null };
}

/**
 * Resolve a map target without network. Unknown towns return a country-scale
 * place plus `geocode`, so the server can try a cached lookup once.
 */
export function resolveCrashMapPlaceSync(incident: PlaceSource): SyncResolution {
  const cityRaw = usableName(incident.city);
  const countryRaw = usableName(incident.country);
  const samePlace =
    cityRaw != null &&
    countryRaw != null &&
    normalizePlaceName(cityRaw) === normalizePlaceName(countryRaw);
  const townName = samePlace ? null : cityRaw;

  const filed = realCoords(finiteCoord(incident.latitude), finiteCoord(incident.longitude));
  const precision = incident.locationPrecision ?? null;
  const inexact = precision == null && contextMarksInexact(incident.context);

  if (precision === "country") {
    if (filed) return none(countryView(filed.latitude, filed.longitude, incident.approxZoom));
    const approx = realCoords(
      finiteCoord(incident.approxLatitude),
      finiteCoord(incident.approxLongitude),
    );
    if (approx) return none(countryView(approx.latitude, approx.longitude, incident.approxZoom));
    return none(countryRaw ? countryFromName(countryRaw) : null);
  }

  if (filed && (precision === "exact" || (precision == null && !inexact))) {
    return none({
      latitude: filed.latitude,
      longitude: filed.longitude,
      zoom: SITE_ZOOM,
      showMarker: true,
      approximate: false,
      scope: "site",
    });
  }

  if (filed && (precision === "town" || inexact)) {
    return none({
      latitude: filed.latitude,
      longitude: filed.longitude,
      zoom: clampZoom(incident.approxZoom, TOWN_ZOOM),
      showMarker: true,
      approximate: true,
      scope: "town",
    });
  }

  const approx = realCoords(
    finiteCoord(incident.approxLatitude),
    finiteCoord(incident.approxLongitude),
  );
  if (approx) {
    const zoom = clampZoom(incident.approxZoom, TOWN_ZOOM);
    const countryScale = zoom <= 6;
    return none({
      latitude: approx.latitude,
      longitude: approx.longitude,
      zoom,
      showMarker: !countryScale,
      approximate: true,
      scope: countryScale ? "country" : "town",
    });
  }

  if (townName && countryRaw) {
    const hit = CITY_INDEX.get(`${normalizePlaceName(townName)}|${normalizePlaceName(countryRaw)}`);
    if (hit) {
      return none({
        latitude: hit.latitude,
        longitude: hit.longitude,
        zoom: TOWN_ZOOM,
        showMarker: true,
        approximate: true,
        scope: "town",
      });
    }
    return {
      place: countryFromName(countryRaw),
      geocode: { city: townName, country: countryRaw },
    };
  }

  if (countryRaw) return none(countryFromName(countryRaw));
  return none(null);
}
