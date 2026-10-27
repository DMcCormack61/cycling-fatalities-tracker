/** Dedicated bicycle ways from OpenStreetMap, drawn on every map. */

export const BIKE_LANE_COLOR = "#0891b2";

export const BIKE_LANE_LABEL = "Dedicated bike lane";

export const BIKE_LANE_NOTE =
  "OpenStreetMap ways tagged as a cycleway or as a bike lane or separated track. Shared-lane markings are not included. Shown by default.";

export type BikeLane = {
  id: string;
  coordinates: [number, number][];
};

type Catalog = {
  sourceName?: string;
  sourceUrl?: string;
  note?: string;
  features?: BikeLane[];
};

export async function loadBundledBikeLanes(signal?: AbortSignal): Promise<BikeLane[]> {
  const res = await fetch("/bike-lanes.json", { signal });
  if (!res.ok) return [];
  const data = (await res.json()) as Catalog;
  if (!Array.isArray(data.features)) return [];
  return data.features.filter(
    (lane) => Array.isArray(lane.coordinates) && lane.coordinates.length >= 2,
  );
}

export function lanesInBounds(
  lanes: BikeLane[],
  west: number,
  south: number,
  east: number,
  north: number,
): BikeLane[] {
  return lanes.filter((lane) => {
    for (const [lng, lat] of lane.coordinates) {
      if (lng >= west && lng <= east && lat >= south && lat <= north) return true;
    }
    return false;
  });
}

const DEDICATED = "^(lane|track|opposite_lane|opposite_track)$";

/** Overpass query for the frame. Returns [] when the public service does not answer. */
export async function queryBikeLanes(bounds: {
  west: number;
  south: number;
  east: number;
  north: number;
  signal?: AbortSignal;
}): Promise<BikeLane[]> {
  const { west, south, east, north, signal } = bounds;
  if (east - west > 0.2 || north - south > 0.16) return [];
  const box = `${south},${west},${north},${east}`;
  const query = `
[out:json][timeout:20];
(
  way["highway"="cycleway"](${box});
  way["cycleway"~"${DEDICATED}"](${box});
  way["cycleway:right"~"${DEDICATED}"](${box});
  way["cycleway:left"~"${DEDICATED}"](${box});
  way["cycleway:both"~"${DEDICATED}"](${box});
);
out geom;
`;
  const timeout = AbortSignal.timeout(18000);
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: query,
    headers: { "Content-Type": "text/plain" },
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    elements?: { type?: string; id?: number; geometry?: { lat: number; lon: number }[] }[];
  };
  const lanes: BikeLane[] = [];
  for (const el of data.elements ?? []) {
    if (el.type !== "way" || !el.id || !el.geometry || el.geometry.length < 2) continue;
    lanes.push({
      id: `osm-${el.id}`,
      coordinates: el.geometry.map((p) => [p.lon, p.lat]),
    });
  }
  return lanes;
}
