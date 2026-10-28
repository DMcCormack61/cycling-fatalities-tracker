import { hpmsStateAt, type HpmsState } from "@/lib/hpms-states";

export type TrafficSegment = {
  id: string;
  place: string;
  state: string;
  stateAbbr: string;
  name: string;
  aadt: number;
  /** Null when the source did not publish a posted speed. */
  speedMph: number | null;
  /** Feet. Omitted or null when the source did not publish a shoulder width. */
  shoulderFt?: number | null;
  functionalClass: string;
  routeId: string;
  service: string;
  coordinates: [number, number][];
};

export type TrafficCatalog = {
  sourceName: string;
  sourceUrl: string;
  retrieved: string;
  note: string;
  features: TrafficSegment[];
};

const FSYS: Record<number, string> = {
  1: "Interstate",
  2: "Freeway or expressway",
  3: "Principal arterial",
  4: "Minor arterial",
  5: "Major collector",
  6: "Minor collector",
  7: "Local",
};

const SIGN: Record<number, string> = {
  2: "I",
  3: "US",
  4: "State",
  5: "Business",
  6: "County",
  8: "Municipal",
};

const STRATA = [
  "aadt>=60000",
  "aadt>=12000 AND aadt<60000",
  "aadt>0 AND aadt<12000",
];

const serviceCache = new Map<string, string>();

type EsriAttrs = {
  aadt?: number | null;
  speed_limit?: number | null;
  routeid?: string | null;
  f_system?: number | null;
  route_number?: number | string | null;
  route_signing?: number | null;
};

type EsriFeature = {
  attributes?: EsriAttrs;
  geometry?: { paths?: number[][][] };
};

function roadName(attrs: EsriAttrs): string {
  const number = attrs.route_number;
  const prefix = attrs.route_signing != null ? SIGN[attrs.route_signing] : undefined;
  if (prefix && number != null && String(number).length > 0) {
    return prefix === "I" ? `${prefix}-${number}` : `${prefix} ${number}`;
  }
  const route = (attrs.routeid ?? "").trim();
  return route || "Unnumbered segment";
}

function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

async function queryService(
  service: string,
  where: string,
  envelope: string,
  signal: AbortSignal,
): Promise<EsriFeature[]> {
  const params = new URLSearchParams({
    where,
    geometry: envelope,
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "aadt,speed_limit,routeid,f_system,route_number,route_signing,stateid",
    returnGeometry: "true",
    outSR: "4326",
    maxAllowableOffset: "0.0004",
    geometryPrecision: "5",
    resultRecordCount: "40",
    f: "json",
  });
  const url = `https://geo.dot.gov/server/rest/services/Hosted/${service}/FeatureServer/0/query?${params}`;
  const timeout = AbortSignal.timeout(22000);
  const res = await fetch(url, { signal: AbortSignal.any([signal, timeout]) });
  if (!res.ok) throw new Error(`${service} returned ${res.status}`);
  const data = (await res.json()) as { error?: { message?: string }; features?: EsriFeature[] };
  if (data.error) throw new Error(data.error.message || `${service} query failed`);
  return data.features ?? [];
}

function toSegment(
  feature: EsriFeature,
  state: HpmsState,
  service: string,
  seen: Set<string>,
): TrafficSegment | null {
  const attrs = feature.attributes ?? {};
  const path = feature.geometry?.paths?.[0];
  if (!path || path.length < 2) return null;
  const aadt = Number(attrs.aadt);
  const speed = Number(attrs.speed_limit);
  if (!Number.isFinite(aadt) || aadt <= 0 || !Number.isFinite(speed) || speed <= 0 || speed > 85) {
    return null;
  }
  const coordinates = path.map(
    ([lng, lat]) => [Math.round(lng * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5] as [number, number],
  );
  const start = coordinates[0];
  const end = coordinates[coordinates.length - 1];
  const key = `${state.abbr}|${aadt}|${speed}|${start[0]}|${start[1]}|${end[0]}|${end[1]}`;
  if (seen.has(key)) return null;
  seen.add(key);
  return {
    id: `${state.abbr.toLowerCase()}-${aadt}-${speed}-${start[0]}-${start[1]}`,
    place: "This view",
    state: state.name,
    stateAbbr: state.abbr,
    name: roadName(attrs),
    aadt,
    speedMph: speed,
    functionalClass: (attrs.f_system != null && FSYS[attrs.f_system]) || "Unclassified",
    routeId: (attrs.routeid ?? "").trim(),
    service,
    coordinates,
  };
}

export async function loadBundledCorridors(signal?: AbortSignal): Promise<TrafficCatalog | null> {
  const res = await fetch("/traffic-corridors.json", { signal });
  if (!res.ok) return null;
  const data = (await res.json()) as Partial<TrafficCatalog>;
  if (!Array.isArray(data.features)) return null;
  return {
    sourceName: data.sourceName ?? "FHWA Highway Performance Monitoring System",
    sourceUrl: data.sourceUrl ?? "https://geo.dot.gov/server/rest/services/Hosted/",
    retrieved: data.retrieved ?? "",
    note: data.note ?? "",
    features: data.features,
  };
}

export async function queryHpmsEnvelope(opts: {
  lat: number;
  lng: number;
  west: number;
  south: number;
  east: number;
  north: number;
  signal: AbortSignal;
}): Promise<{ state: HpmsState; segments: TrafficSegment[] }> {
  const state = hpmsStateAt(opts.lat, opts.lng);
  if (!state) throw new Error("That view is outside the state HPMS layers.");
  const envelope = `${opts.west},${opts.south},${opts.east},${opts.north}`;
  const cached = serviceCache.get(state.abbr);
  const order = cached
    ? [cached, ...state.services.filter((name) => name !== cached)]
    : state.services;
  let lastError: Error | null = null;
  const attempts = order.slice(0, 2);
  for (const service of attempts) {
    try {
      const batches = await Promise.all(
        STRATA.map((stratum) =>
          queryService(
            service,
            `(${stratum}) AND speed_limit>0 AND speed_limit<=85`,
            envelope,
            opts.signal,
          ),
        ),
      );
      serviceCache.set(state.abbr, service);
      const seen = new Set<string>();
      const segments: TrafficSegment[] = [];
      for (const batch of batches) {
        for (const feature of batch) {
          const segment = toSegment(feature, state, service, seen);
          if (segment) segments.push(segment);
        }
      }
      return { state, segments };
    } catch (err) {
      if (isAbort(err) || opts.signal.aborted) throw err;
      lastError = err instanceof Error ? err : new Error("HPMS query failed");
    }
  }
  throw lastError ?? new Error("FHWA HPMS did not return sections for this state.");
}
