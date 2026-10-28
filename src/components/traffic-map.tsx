import { useEffect, useMemo, useRef, useState } from "react";
import {
  classifySegments,
  usesLancasterColors,
  type TrafficBandName,
} from "@/lib/traffic-bands.mjs";
import {
  BIKE_LANE_COLOR,
  lanesInBounds,
  loadBundledBikeLanes,
  queryBikeLanes,
  type BikeLane,
} from "@/lib/bike-lanes";
import { BikeLaneToggle } from "@/components/bike-lane-toggle";
import { hpmsStateAt } from "@/lib/hpms-states";
import {
  loadBundledCorridors,
  queryHpmsEnvelope,
  type TrafficSegment,
} from "@/lib/hpms-query";
import { formatCompact } from "@/lib/format";
import { PENNDOT_COUNTIES, PENNDOT_PLACE_NAMES, PENNDOT_REGION_LABEL } from "@/lib/penndot-region.mjs";
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

const LANCASTER_BAND_COPY: Record<TrafficBandName, string> = {
  red: "Volume and speed are both in the upper 20% of the sections drawn in this view. A shoulder wider than 4 ft with a posted speed under 45 mph would have stayed amber.",
  orange:
    "Amber because the shoulder is under 2 ft, posted speed is over 40 mph, volume is over 1,000 vehicles per day, only one of volume and speed is in the upper 20%, or a shoulder wider than 4 ft kept a slow road from turning red.",
  green:
    "Volume under 400 vehicles per day is green only when shoulder, speed, and volume do not force amber or red.",
};

function bandCopy(segment: { service?: string; band: TrafficBandName }): string {
  return usesLancasterColors(segment) ? LANCASTER_BAND_COPY[segment.band] : BAND_COPY[segment.band];
}

function bandTitle(segment: { service?: string; band: TrafficBandName }): string {
  if (!usesLancasterColors(segment)) return TRAFFIC_BAND_LABEL[segment.band];
  if (segment.band === "orange") return "Amber";
  if (segment.band === "green") return "Low volume";
  return TRAFFIC_BAND_LABEL.red;
}

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

const LANCASTER_REGION = TRAFFIC_CITIES.find((city) => city.label === PENNDOT_REGION_LABEL);

function viewInPennDotRegion(view: MapView | null): boolean {
  if (!view || !LANCASTER_REGION?.bounds || view.zoom < 8) return false;
  const [west, south, east, north] = LANCASTER_REGION.bounds;
  return view.lng >= west && view.lng <= east && view.lat >= south && view.lat <= north;
}

function pennDotCountyList(): string {
  return PENNDOT_COUNTIES.map((county) => `${county.name.replace(" County", "")} (${county.code})`).join(", ");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function postedSpeed(speedMph: number | null): string {
  if (speedMph == null || !Number.isFinite(speedMph)) return "Not published";
  return `${formatCompact(speedMph)} mph`;
}

function shoulderText(shoulderFt: number | null | undefined): string | null {
  if (shoulderFt == null || !Number.isFinite(shoulderFt)) return null;
  return `${formatCompact(shoulderFt)} ft`;
}

function roadPopupHtml(segment: TrafficSegment): string {
  const shoulder = shoulderText(segment.shoulderFt);
  return `<p class="font-display text-base leading-snug text-fg">${escapeHtml(segment.name)}</p>
<dl class="mt-2 space-y-1 text-sm text-fg">
  <div><dt class="text-[0.6875rem] uppercase tracking-[0.12em] text-subtle">Traffic volume</dt><dd class="tabular-nums">${formatCompact(segment.aadt)} vehicles per day</dd></div>
  <div><dt class="text-[0.6875rem] uppercase tracking-[0.12em] text-subtle">Posted speed limit</dt><dd class="tabular-nums">${escapeHtml(postedSpeed(segment.speedMph))}</dd></div>
  ${
    shoulder
      ? `<div><dt class="text-[0.6875rem] uppercase tracking-[0.12em] text-subtle">Shoulder width</dt><dd class="tabular-nums">${escapeHtml(shoulder)}</dd></div>`
      : ""
  }
</dl>`;
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
  const highlightRef = useRef<{ clearLayers: () => void } | null>(null);
  const laneGroupRef = useRef<{ clearLayers: () => void } | null>(null);
  const rendererRef = useRef<unknown>(null);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<MapView | null>(null);
  const [bundled, setBundled] = useState<TrafficSegment[]>([]);
  const [live, setLive] = useState<TrafficSegment[] | null>(null);
  const [phase, setPhase] = useState<Phase>({
    kind: "loading",
    message: "Loading saved traffic sections…",
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lanesOn, setLanesOn] = useState(true);
  const [bundledLanes, setBundledLanes] = useState<BikeLane[]>([]);
  const [liveLanes, setLiveLanes] = useState<BikeLane[]>([]);
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
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · <a href="https://geo.dot.gov/server/rest/services/Hosted/">FHWA HPMS</a> · Lancaster <a href="https://gis.penndot.gov/gis/rest/services/opendata/roadwaysegments/MapServer">PennDOT</a>',
        })
        .addTo(map);
      const group = leaflet.layerGroup().addTo(map);
      groupRef.current = group;
      highlightRef.current = leaflet.layerGroup().addTo(map);
      laneGroupRef.current = leaflet.layerGroup().addTo(map);
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
    if (viewInPennDotRegion(view) || view.zoom < TRAFFIC_LIVE_MIN_ZOOM) {
      liveStateRef.current = null;
      setLive(null);
      setPhase({
        kind: "saved",
        message: viewInPennDotRegion(view)
          ? "Lancaster and its Pennsylvania neighbors use PennDOT roadway volumes. Click a line for the road name, vehicles per day, posted speed, and shoulder width when PennDOT published it."
          : "Zoom in, or choose a city, to load HPMS sections for that state. Saved corridors stay drawn where they fall in view.",
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
    if (viewInPennDotRegion(view)) {
      const region = bundled.filter(
        (segment) => PENNDOT_PLACE_NAMES.has(segment.place) && segment.service.startsWith("PennDOT") && inView(segment),
      );
      if (region.length > 0) return region;
    }
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
  const lancasterColors = shown.length > 0 && shown.every((segment) => usesLancasterColors(segment));

  useEffect(() => {
    const leaflet = leafletRef.current;
    const group = groupRef.current as {
      clearLayers: () => void;
      addLayer?: (layer: unknown) => void;
    } | null;
    const renderer = rendererRef.current;
    if (!ready || !leaflet || !group || !renderer) return;
    group.clearLayers();
    const count = classified.segments.length;
    const dense = count > 500;
    const packed = count > 4000;
    for (const segment of classified.segments) {
      const latlngs = segment.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]);
      if (latlngs.length < 2) continue;
      const color = TRAFFIC_COLORS[segment.band];
      const select = (event: { latlng?: { lat: number; lng: number } }) => {
        setSelectedId(segment.id);
        const map = mapRef.current;
        const latlng = event.latlng ?? {
          lat: segment.coordinates[0][1],
          lng: segment.coordinates[0][0],
        };
        if (!map) return;
        leaflet
          .popup({ className: "traffic-road-popup", maxWidth: 280, autoPan: true })
          .setLatLng(latlng)
          .setContent(roadPopupHtml(segment))
          .openOn(map as never);
      };
      if (!packed) {
        leaflet
          .polyline(latlngs, {
            renderer: renderer as never,
            color: "#ffffff",
            weight: dense ? 5 : 8,
            opacity: 0.95,
            interactive: false,
          })
          .addTo(group as never);
      }
      const line = leaflet
        .polyline(latlngs, {
          renderer: renderer as never,
          color,
          weight: packed ? 2 : dense ? 3 : 5,
          opacity: 0.96,
          interactive: !dense,
        })
        .addTo(group as never);
      if (dense && !packed) {
        leaflet
          .polyline(latlngs, {
            renderer: renderer as never,
            color,
            weight: 12,
            opacity: 0,
          })
          .addTo(group as never)
          .on("click", select);
      } else if (!dense) {
        line.on("click", select);
      }
      const mid = segment.coordinates[Math.floor(segment.coordinates.length / 2)];
      leaflet
        .circleMarker([mid[1], mid[0]], {
          renderer: renderer as never,
          radius: packed ? 3 : dense ? 5 : 6,
          color: "#ffffff",
          weight: packed ? 1 : dense ? 1 : 2,
          fillColor: color,
          fillOpacity: 0.96,
        })
        .addTo(group as never)
        .on("click", select);
    }
  }, [classified.segments, ready]);

  useEffect(() => {
    const leaflet = leafletRef.current;
    const group = highlightRef.current as { clearLayers: () => void } | null;
    const renderer = rendererRef.current;
    if (!ready || !leaflet || !group || !renderer) return;
    group.clearLayers();
    const segment = classified.segments.find((item) => item.id === selectedId);
    if (!segment) return;
    const latlngs = segment.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]);
    if (latlngs.length < 2) return;
    const color = TRAFFIC_COLORS[segment.band];
    leaflet
      .polyline(latlngs, {
        renderer: renderer as never,
        color: "#ffffff",
        weight: 10,
        opacity: 0.95,
        interactive: false,
      })
      .addTo(group as never);
    leaflet
      .polyline(latlngs, {
        renderer: renderer as never,
        color,
        weight: 6,
        opacity: 1,
        interactive: false,
      })
      .addTo(group as never);
  }, [classified.segments, ready, selectedId]);

  useEffect(() => {
    const controller = new AbortController();
    void loadBundledBikeLanes(controller.signal)
      .then(setBundledLanes)
      .catch(() => {
        /* Live Overpass can still fill a close view. */
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!view || !lanesOn || view.zoom < 13) {
      setLiveLanes([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void queryBikeLanes({ ...view, signal: controller.signal })
        .then((lanes) => {
          if (!controller.signal.aborted) setLiveLanes(lanes);
        })
        .catch(() => {
          if (!controller.signal.aborted) setLiveLanes([]);
        });
    }, 500);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [view, lanesOn]);

  const lanesToDraw = useMemo(() => {
    if (!lanesOn) return [];
    if (!view) return liveLanes.length > 0 ? liveLanes : bundledLanes;
    const live = lanesInBounds(liveLanes, view.west, view.south, view.east, view.north);
    if (live.length > 0) return live;
    return lanesInBounds(bundledLanes, view.west, view.south, view.east, view.north);
  }, [lanesOn, liveLanes, bundledLanes, view]);

  useEffect(() => {
    const leaflet = leafletRef.current;
    const group = laneGroupRef.current;
    const renderer = rendererRef.current;
    if (!ready || !leaflet || !group || !renderer) return;
    group.clearLayers();
    const drawLines = (view?.zoom ?? 0) >= 12;
    for (const lane of lanesToDraw) {
      const latlngs = lane.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]);
      if (latlngs.length < 2) continue;
      if (drawLines) {
        leaflet
          .polyline(latlngs, {
            renderer: renderer as never,
            color: "#ffffff",
            weight: 5,
            opacity: 0.9,
            interactive: false,
          })
          .addTo(group as never);
        leaflet
          .polyline(latlngs, {
            renderer: renderer as never,
            color: BIKE_LANE_COLOR,
            weight: 3,
            opacity: 0.95,
            dashArray: "7 5",
            interactive: false,
          })
          .addTo(group as never);
      }
      const mid = latlngs[Math.floor(latlngs.length / 2)];
      leaflet
        .circleMarker(mid, {
          renderer: renderer as never,
          radius: drawLines ? 4 : 5,
          color: "#ffffff",
          weight: 2,
          fillColor: BIKE_LANE_COLOR,
          fillOpacity: 0.95,
          interactive: false,
        })
        .addTo(group as never);
    }
  }, [lanesToDraw, ready, view]);

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
            body={
              lancasterColors
                ? "Volume and speed are both in the upper 20%, unless the shoulder is wider than 4 ft and the posted speed is under 45 mph."
                : "Volume and speed are both in the upper 20%."
            }
            count={counts.red}
          />
          <LegendItem
            color={TRAFFIC_COLORS.orange}
            title={lancasterColors ? "Amber · forced" : "Orange · one high"}
            body={
              lancasterColors
                ? "Shoulder under 2 ft (including 0), posted speed over 40 mph, or volume over 1,000 vehicles per day. A shoulder wider than 4 ft with a posted speed under 45 mph also stays amber instead of red."
                : "Volume and/or speed are high, but not both in the upper 20%."
            }
            count={counts.orange}
          />
          <LegendItem
            color={TRAFFIC_COLORS.green}
            title={lancasterColors ? "Green · under 400" : "Green · both low"}
            body={
              lancasterColors
                ? "Volume under 400 vehicles per day is green only when it is not forced amber or red."
                : "Speed is low and volume is low."
            }
            count={counts.green}
          />
        </ul>
        <div className="mt-3">
          <BikeLaneToggle on={lanesOn} onChange={setLanesOn} />
        </div>
        <p className="mt-3 text-sm text-muted">
          {lancasterColors ? (
            <>
              Red is both volume and speed at or above the 80th percentile of the sections drawn
              here
              {volumeCutoff != null && speedCutoff != null ? (
                <>
                  {" "}
                  (
                  <span className="tabular-nums text-fg">{formatThreshold(volumeCutoff)} vehicles per day</span>{" "}
                  and <span className="tabular-nums text-fg">{formatThreshold(speedCutoff)} mph</span>)
                </>
              ) : null}
              . A shoulder wider than 4 ft with a posted speed under 45 mph is never red, even when
              both are in that upper 20%. Amber is the minimum when the published shoulder is under
              2 ft, posted speed is over 40 mph, or volume is over 1,000 vehicles per day. Volume
              under 400 vehicles per day is
              green only when those amber rules do not apply and the section is not red. A section
              with at least 400 vehicles per day can still be amber when only volume or only speed
              is in the upper 20%.
            </>
          ) : volumeCutoff != null && speedCutoff != null ? (
            <>
              High means at or above the 80th percentile of the sections drawn here:{" "}
              <span className="tabular-nums text-fg">{formatThreshold(volumeCutoff)} vehicles per day</span>{" "}
              and{" "}
              <span className="tabular-nums text-fg">{formatThreshold(speedCutoff)} mph</span>.
              A section with no published speed is colored from volume alone, so it can be orange or
              green and is not red.
            </>
          ) : volumeCutoff != null ? (
            <>
              Posted speed is missing for these sections. High volume is at or above{" "}
              <span className="tabular-nums text-fg">{formatThreshold(volumeCutoff)} vehicles per day</span>
              . Those roads are orange when volume is high and green when it is not.
            </>
          ) : (
            "High means at or above the 80th percentile of the sections drawn here. Zoom to a city to compare roads."
          )}
        </p>
        <p className="mt-3 text-sm text-muted">
          The Lancaster region is {pennDotCountyList()}, drawn from PennDOT RMS state routes and the
          Pennsylvania local-road inventory at{" "}
          <a
            className="text-accent underline-offset-4 hover:underline"
            href="https://gis.penndot.gov/gis/rest/services/opendata/roadwaysegments/MapServer"
          >
            gis.penndot.gov
          </a>
          . Cecil and Harford counties in Maryland also border Lancaster and are not in this layer.
          The same popup fields and amber, red, and green rules apply in every PennDOT county here.
          Other places stay on the FHWA HPMS sample. Click a road line for its name, vehicles per
          day, posted speed limit, and shoulder width when PennDOT published one.
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
                <dd className="text-xs text-muted">Vehicles per day</dd>
              </div>
              <div>
                <dt className="text-[0.6875rem] uppercase tracking-[0.14em] text-subtle">
                  Posted speed limit
                </dt>
                <dd className="mt-1 font-display text-2xl tabular-nums text-fg">
                  {postedSpeed(selected.speedMph)}
                </dd>
                <dd className="text-xs text-muted">
                  {selected.speedMph == null ? "Not published" : "Posted speed"}
                </dd>
              </div>
              <div>
                <dt className="text-[0.6875rem] uppercase tracking-[0.14em] text-subtle">
                  Shoulder width
                </dt>
                <dd className="mt-1 font-display text-2xl tabular-nums text-fg">
                  {shoulderText(selected.shoulderFt) ?? "Not published"}
                </dd>
                <dd className="text-xs text-muted">
                  {selected.shoulderFt == null ? "Not published" : "Published shoulder"}
                </dd>
              </div>
              <div>
                <dt className="text-[0.6875rem] uppercase tracking-[0.14em] text-subtle">Band</dt>
                <dd className="mt-1 flex items-center gap-2 font-display text-2xl text-fg">
                  <span
                    className="inline-block size-3 rounded-full"
                    style={{ background: TRAFFIC_COLORS[selected.band] }}
                    aria-hidden
                  />
                  {bandTitle(selected)}
                </dd>
                <dd className="text-xs text-muted">{bandCopy(selected)}</dd>
              </div>
            </dl>
          </>
        ) : (
          <>
            <h2 className="font-display text-xl text-fg">Volume and speed for one section</h2>
            <p className="mt-2 text-sm text-muted">
              Click a colored road line to open its name, vehicles per day, posted speed limit,
              and shoulder width when the record includes one. The same fields stay in this card.
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
            {rows.slice(0, 80).map((segment) => {
              const active = segment.id === selectedId;
              return (
                <li key={segment.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(segment.id);
                      const leaflet = leafletRef.current;
                      const map = mapRef.current;
                      const mid = segment.coordinates[Math.floor(segment.coordinates.length / 2)];
                      if (!leaflet || !map || !mid) return;
                      leaflet
                        .popup({ className: "traffic-road-popup", maxWidth: 280, autoPan: true })
                        .setLatLng({ lat: mid[1], lng: mid[0] })
                        .setContent(roadPopupHtml(segment))
                        .openOn(map as never);
                    }}
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
                        {bandTitle(segment)}
                        {segment.place !== "This view" ? ` · ${segment.place}` : ""}
                      </span>
                    </span>
                    <span className="tabular-nums text-fg">{formatCompact(segment.aadt)}</span>
                    <span className="tabular-nums text-muted">
                      {segment.speedMph == null ? "—" : `${segment.speedMph} mph`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {rows.length > 80 ? (
          <p className="px-4 py-3 text-sm text-muted">
            The list shows the 80 highest volumes. The map draws all{" "}
            <span className="tabular-nums">{formatCompact(rows.length)}</span> sections. Click a
            line for its name, vehicles per day, posted speed, and shoulder width when published.
          </p>
        ) : null}
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
