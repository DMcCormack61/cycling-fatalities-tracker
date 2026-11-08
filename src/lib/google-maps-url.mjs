/**
 * Google Maps search URL for a crash detail page.
 * Filed coordinates win. Otherwise the query is street / cross street, city, state.
 * Returns null when neither is available, so the page can hide the link.
 *
 * @param {{
 *   latitude?: number | string | null,
 *   longitude?: number | string | null,
 *   locationName?: string | null,
 *   city?: string | null,
 *   state?: string | null,
 * }} place
 * @returns {string | null}
 */
export function googleMapsSearchUrl(place) {
  const coords = filedCoordinates(place?.latitude, place?.longitude);
  if (coords) {
    return `https://www.google.com/maps/search/?api=1&query=${coords.latitude},${coords.longitude}`;
  }
  const query = locationQuery(place);
  if (!query) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function filedCoordinates(latitude, longitude) {
  const lat = finiteNumber(latitude);
  const lng = finiteNumber(longitude);
  if (lat == null || lng == null) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  if (lat === 0 && lng === 0) return null;
  return { latitude: formatCoord(lat), longitude: formatCoord(lng) };
}

function finiteNumber(value) {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatCoord(value) {
  const text = String(value);
  if (!/[eE]/.test(text)) return text;
  return value.toFixed(6).replace(/\.?0+$/, "");
}

function locationQuery(place) {
  const street = plainText(place?.locationName);
  const city = plainText(place?.city);
  const state = plainText(place?.state);
  const stateKey = state?.toLowerCase() ?? null;
  const seen = new Set();
  const parts = [];

  const push = (value) => {
    if (!value) return;
    const key = value.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    parts.push(value);
  };

  if (street) {
    for (const segment of street.split(",")) {
      const piece = segment.trim();
      if (!piece) continue;
      if (stateKey && piece.toLowerCase() === stateKey) continue;
      push(piece);
    }
  }
  push(city);
  push(state);
  return parts.length > 0 ? parts.join(", ") : null;
}

function plainText(value) {
  if (value == null) return null;
  const trimmed = String(value).replace(/\s+/g, " ").trim();
  return trimmed || null;
}
