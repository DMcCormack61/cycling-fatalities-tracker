import { useEffect, useMemo, useRef, useState } from "react";
import { classifySegments, type TrafficBandName } from "@/lib/traffic-bands.mjs";
import { hpmsStateAt } from "@/lib/hpms-states";
import {
  loadBundledCorridors,
  queryHpmsEnvelope,
  type TrafficSegment,
} from "@/lib/hpms-query";
import { formatCompact } from "@/lib/format";
import {
  TRAFFIC_BAND_LABEL,
  TRAFFIC_CITIES,
  TRAFFIC_COLORS,
  TRAFFIC_LIVE_MIN_ZOOM,
  UNITED_STATES_VIEW,
  type TrafficPlace,
} from "@/lib/traffic-places";
import { cn } from "@/lib/utils";

type MapView = {
  lat: number;
  lng: number;
  zoom: number;
  west: number;
  south: number;
  east: number;
  north: number;
};

type Phase =
  | { kind: "loading"; message: string }
  | { kind: "live"; message: string }
  | { kind: "saved"; message: string }
  | { kind: "error"; message: string };

type LeafletNs = typeof import("leaflet");

const BAND_COPY: Record<TrafficBandName, string> = {
  red: "Both volume and speed are in the upper 20% of the sections drawn in this view.",
  orange: "Volume and/or speed are high, but not both in the upper 20%.",
  green: "Speed is low and volume is low — both sit below the upper 20% of this view.",
};

function readView(map: { getBounds: () => LBounds; getCenter: () => { lat: number; lng: number }; getZoom: () => number }): MapView {
  const bounds = map.getBounds();
  const center = map.getCenter();
  return {
    lat: center.lat,
    lng: center.lng,
    zoom: map.getZoom(),
    west: bounds.getWest(),
    south: bounds.getSouth(),
    east: bounds.getEast(),
    north: bounds.getNorth(),
  };
}

type LBounds = {
  getWest: () => number;
  getSouth: () => number;
  getEast: () => number;
  getNorth: () => number;
};

function overlaps(segment: TrafficSegment, view: MapView): boolean {
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const [lng, lat] of segment.coordinates) {
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }
  return maxLng >= view.west && minLng <= view.east && maxLat >= view.south && minLat <= view.north;
}

function formatThreshold(value: number): string {
  return formatCompact(Math.ceil(value));
}

function activePlace(view: MapView | null): string {
  if (!view || view.zoom < 6) return UNITED_STATES_VIEW.label;
  for (const city of TRAFFIC_CITIES) {
    if (!city.bounds) continue;
    const [west, south, east, north] = city.bounds;
    if (view.lng >= west && view.lng <= east && view.lat >= south && view.lat <= north) {
      return city.label;
    }
  }
  let best = "";
  let bestDistance = 0.45;
  for (const city of TRAFFIC_CITIES) {
    const distance = Math.hypot(city.lat - view.lat, city.lng - view.lng);
    if (distance < bestDistance) {
      best = city.label;
      bestDistance = distance;
    }
  }
  return best;
}

export function TrafficMap() {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<{
    setView: (center: [number, number], zoom: number, options?: { animate?: boolean }) => void;
    fitBounds: (
      bounds: [[number, number], [number, number]],
      options?: { padding?: [number, number]; animate?: boolean; maxZoom?: number },
    ) => void;
    remove: () => void;
  } | null>(null);
  const leafletRef = useRef<LeafletNs | null>(null);
  const groupRef = useRef<{ clearLayers: () => void } | null>(null);
  const rendererRef = useRef<unknown>(null);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<MapView | null>(null);
  const [bundled, setBundled] = useState<TrafficSegment[]>([]);
  const [live, setLive] = useState<TrafficSegment[] | null>(null);
  const [phase, setPhase] = useState<Phase>({
    kind: "loading",
    message: "Loading saved FHWA corridors…",
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const liveStateRef = useRef<string | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let created: { remove: () => void; on: (name: string, fn: () => void) => void } | null = null;

    void (async () => {
      const loaded = await Promise.all([import("leaflet"), import("leaflet/dist/leaflet.css")]);
      const mod = loaded[0] as LeafletNs & { default?: LeafletNs };
      const leaflet = typeof mod.map === "function" ? mod : (mod.default ?? mod);
      if (cancelled || !hostRef.current || typeof leaflet.map !== "function") return;
      const reduce =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      hostRef.current.replaceChildren();
      const map = leaflet.map(hostRef.current, {
        center: [TRAFFIC_CITIES[0].lat, TRAFFIC_CITIES[0].lng],
        zoom: TRAFFIC_CITIES[0].zoom,
        scrollWheelZoom: true,
        zoomAnimation: !reduce,
        fadeAnimation: !reduce,
      });
      if (cancelled) {
        map.remove();
        return;
      }
      created = map;
      mapRef.current = map;
      leafletRef.current = leaflet;
      leaflet
        .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · Traffic <a href="https://geo.dot.gov/server/rest/services/Hosted/">FHWA HPMS</a>',
        })
        .addTo(map);
      const group = leaflet.layerGroup().addTo(map);
      groupRef.current = group;
      rendererRef.current = leaflet.canvas({ padding: 0.5 });
      const publish = () => {
        if (!cancelled) setView(readView(map));
      };
      map.on("moveend", publish);
      requestAnimationFrame(() => map.invalidateSize());
      publish();
      setReady(true);
    })().catch(() => {
      if (!cancelled) {
        setPhase({ kind: "error", message: "The street map did not start." });
      }
    });

    return () => {
      cancelled = true;
      created?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadBundledCorridors(controller.signal)
      .then((catalog) => {
        if (controller.signal.aborted || !catalog) return;
        setBundled(catalog.features);
      })
      .catch(() => {
        /* Live HPMS queries still run when the bundle is missing. */
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!view) return;
    const state = hpmsStateAt(view.lat, view.lng);
    if (state?.abbr !== liveStateRef.current) {
      liveStateRef.current = null;
      setLive(null);
    }
    if (view.zoom < TRAFFIC_LIVE_MIN_ZOOM) {
      liveStateRef.current = null;
      setLive(null);
      setPhase({
        kind: "saved",
        message:
          "Zoom in, or choose a city, to load HPMS sections for that state. Saved corridors stay drawn where they fall in view.",
      });
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setPhase({ kind: "loading", message: "Loading FHWA traffic sections for this view…" });
      void queryHpmsEnvelope({ ...view, signal: controller.signal })
        .then((result) => {
          if (controller.signal.aborted) return;
          liveStateRef.current = result.state.abbr;
          setLive(result.segments);
          const count = result.segments.length;
          setPhase({
            kind: count > 0 ? "live" : "saved",
            message:
              count > 0
                ? `${formatCompact(count)} ${result.state.name} sections from FHWA HPMS (a sample of up to 40 in each volume band).`
                : `FHWA returned no ${result.state.name} sections with both volume and a posted speed here. Saved corridors in view stay drawn.`,
          });
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          if (err instanceof DOMException && err.name === "AbortError") return;
          setLive(null);
          setPhase({
            kind: "error",
            message: "FHWA HPMS did not respond. Saved corridors in view are still drawn.",
          });
        });
    }, 400);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [view]);

  const shown = useMemo(() => {
    const inView = (segment: TrafficSegment) => (view ? overlaps(segment, view) : true);
    const liveInView = live?.filter(inView) ?? [];
    if (liveInView.length > 0) return liveInView;
    return bundled.filter(inView);
  }, [live, bundled, view]);

  const classified = useMemo(() => classifySegments(shown), [shown]);
  const selected = classified.segments.find((segment) => segment.id === selectedId) ?? null;
  const rows = useMemo(
    () => [...classified.segments].sort((a, b) => b.aadt - a.aadt),
    [classified.segments],
  );
  const counts = useMemo(() => {
    const tally = { red: 0, orange: 0, green: 0 };
    for (const segment of classified.segments) tally[segment.band] += 1;
    return tally;
  }, [classified.segments]);

  useEffect(() => {
    const leaflet = leafletRef.current;
    const group = groupRef.current as {
      clearLayers: () => void;
      addLayer?: (layer: unknown) => void;
    } | null;
    const renderer = rendererRef.current;
    if (!ready || !leaflet || !group || !renderer) return;
    group.clearLayers();
    for (const segment of classified.segments) {
      const latlngs = segment.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]);
      if (latlngs.length < 2) continue;
      const chosen = segment.id === selectedId;
      const color = TRAFFIC_COLORS[segment.band];
      const select = () => setSelectedId(segment.id);
      leaflet
        .polyline(latlngs, {
          renderer: renderer as never,
          color: "#ffffff",
          weight: chosen ? 10 : 8,
          opacity: 0.95,
          interactive: false,
        })
        .addTo(group as never);
      leaflet
        .polyline(latlngs, {
          renderer: renderer as never,
          color,
          weight: chosen ? 6 : 5,
          opacity: 0.96,
        })
        .addTo(group as never)
        .on("click", select);
      const mid = segment.coordinates[Math.floor(segment.coordinates.length / 2)];
      leaflet
        .circleMarker([mid[1], mid[0]], {
          renderer: renderer as never,
          radius: chosen ? 8 : 6,
          color: "#ffffff",
          weight: 2,
          fillColor: color,
          fillOpacity: 0.96,
        })
        .addTo(group as never)
        .on("click", select);
    }
  }, [classified.segments, ready, selectedId]);

  function go(place: TrafficPlace) {
    const reduce =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const map = mapRef.current;
    if (!map) return;
    if (place.bounds) {
      const [west, south, east, north] = place.bounds;
      map.fitBounds(
        [
          [south, west],
          [north, east],
        ],
        { padding: [28, 28], animate: !reduce, maxZoom: place.zoom },
      );
      return;
    }
    map.setView([place.lat, place.lng], place.zoom, { animate: !reduce });
  }

  const current = activePlace(view);
  const volumeCutoff = classified.volumeCutoff;
  const speedCutoff = classified.speedCutoff;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 overflow-x-auto pb-1">
        <PlaceChip
          label={UNITED_STATES_VIEW.label}
          active={current === UNITED_STATES_VIEW.label}
          onClick={() => go(UNITED_STATES_VIEW)}
        />
        {TRAFFIC_CITIES.map((city) => (
          <PlaceChip
            key={city.label}
            label={city.label}
            active={current === city.label}
            onClick={() => go(city)}
          />
        ))}
      </div>

      <section
        aria-label="Color rules for traffic volume and speed"
        className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]"
      >
        <p className="text-[0.6875rem] uppercase tracking-[0.16em] text-subtle">
          Sections in this view
        </p>
        <ul className="mt-3 grid gap-3 sm:grid-cols-3">
          <LegendItem
            color={TRAFFIC_COLORS.red}
            title="Red · high / high"
            body="Volume and speed are both in the upper 20%."
            count={counts.red}
          />
          <LegendItem
            color={TRAFFIC_COLORS.orange}
            title="Orange · one high"
            body="Volume and/or speed are high, but not both in the upper 20%."
            count={counts.orange}
          />
          <LegendItem
            color={TRAFFIC_COLORS.green}
            title="Green · both low"
            body="Speed is low and volume is low."
            count={counts.green}
          />
        </ul>
        <p className="mt-3 text-sm text-muted">
          {volumeCutoff != null && speedCutoff != null ? (
            <>
              High means at or above the 80th percentile of the sections drawn here:{" "}
              <span className="tabular-nums text-fg">{formatThreshold(volumeCutoff)} AADT</span>{" "}
              and{" "}
              <span className="tabular-nums text-fg">{formatThreshold(speedCutoff)} mph</span>.
            </>
          ) : (
            "High means at or above the 80th percentile of the sections drawn here. Zoom to a city to compare roads."
          )}
        </p>
        <p className="mt-1 text-sm text-subtle" role="status">
          {phase.message}
        </p>
      </section>

      <div className="h-[26rem] overflow-hidden rounded-xl bg-surface shadow-[var(--shadow-border)] sm:h-[36rem]">
        <div
          ref={hostRef}
          className="traffic-map h-full w-full"
          role="application"
          aria-label="United States street map of traffic volume and posted speed limits"
        />
      </div>

      <article className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
        {selected ? (
          <>
            <p className="text-[0.6875rem] uppercase tracking-[0.16em] text-subtle">
              Selected section
            </p>
            <h2 className="mt-1 font-display text-2xl text-fg">{selected.name}</h2>
            <p className="text-sm text-muted">
              {selected.place === "This view" ? selected.state : `${selected.place}, ${selected.state}`}
              {selected.functionalClass ? ` · ${selected.functionalClass}` : ""}
            </p>
            <dl className="mt-4 grid gap-3 sm:grid-cols-3">
              <div>
                <dt className="text-[0.6875rem] uppercase tracking-[0.14em] text-subtle">
                  Traffic volume
                </dt>
                <dd className="mt-1 font-display text-2xl tabular-nums text-fg">
                  {formatCompact(selected.aadt)}
                </dd>
                <dd className="text-xs text-muted">AADT, vehicles per day</dd>
              </div>
              <div>
                <dt className="text-[0.6875rem] uppercase tracking-[0.14em] text-subtle">
                  Speed limit
                </dt>
                <dd className="mt-1 font-display text-2xl tabular-nums text-fg">
                  {formatCompact(selected.speedMph)} mph
                </dd>
                <dd className="text-xs text-muted">Posted speed</dd>
              </div>
              <div>
                <dt className="text-[0.6875rem] uppercase tracking-[0.14em] text-subtle">Band</dt>
                <dd className="mt-1 flex items-center gap-2 font-display text-2xl text-fg">
                  <span
                    className="inline-block size-3 rounded-full"
                    style={{ background: TRAFFIC_COLORS[selected.band] }}
                    aria-hidden
                  />
                  {TRAFFIC_BAND_LABEL[selected.band]}
                </dd>
                <dd className="text-xs text-muted">{BAND_COPY[selected.band]}</dd>
              </div>
            </dl>
          </>
        ) : (
          <>
            <h2 className="font-display text-xl text-fg">Volume and speed for one section</h2>
            <p className="mt-2 text-sm text-muted">
              Select a colored section on the map, or a row below, to read its annual average
              daily traffic and posted speed limit.
            </p>
          </>
        )}
      </article>

      <section className="rounded-xl bg-surface shadow-[var(--shadow-border)]">
        <div className="flex items-baseline justify-between gap-3 px-4 py-3">
          <h2 className="font-display text-xl text-fg">Sections in view</h2>
          <p className="text-xs tabular-nums text-subtle">{formatCompact(rows.length)} drawn</p>
        </div>
        {rows.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-muted">
            No sections in this frame yet. Choose a city to open local roads.
          </p>
        ) : (
          <ul className="max-h-96 divide-y divide-border overflow-y-auto">
            {rows.map((segment) => {
              const active = segment.id === selectedId;
              return (
                <li key={segment.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(segment.id)}
                    className={cn(
                      "grid w-full grid-cols-[auto_1fr_auto_auto] items-center gap-3 px-4 py-3 text-left text-sm",
                      active ? "bg-elevated" : "hover:bg-elevated",
                    )}
                  >
                    <span
                      className="size-2.5 rounded-full"
                      style={{ background: TRAFFIC_COLORS[segment.band] }}
                      aria-hidden
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-fg">{segment.name}</span>
                      <span className="block truncate text-xs text-subtle">
                        {TRAFFIC_BAND_LABEL[segment.band]}
                        {segment.place !== "This view" ? ` · ${segment.place}` : ""}
                      </span>
                    </span>
                    <span className="tabular-nums text-fg">{formatCompact(segment.aadt)}</span>
                    <span className="tabular-nums text-muted">{segment.speedMph} mph</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function PlaceChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "shrink-0 rounded-full px-3 py-1.5 text-sm",
        active ? "bg-navy text-cream" : "bg-surface text-fg shadow-[var(--shadow-border)]",
      )}
    >
      {label}
    </button>
  );
}

function LegendItem({
  color,
  title,
  body,
  count,
}: {
  color: string;
  title: string;
  body: string;
  count: number;
}) {
  return (
    <li className="flex gap-3">
      <span className="mt-1 h-3 w-8 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
      <span>
        <span className="block text-sm font-semibold text-fg">{title}</span>
        <span className="mt-0.5 block text-sm text-muted">{body}</span>
        <span className="mt-1 block text-xs tabular-nums text-subtle">
          {formatCompact(count)} {count === 1 ? "section" : "sections"}
        </span>
      </span>
    </li>
  );
}
