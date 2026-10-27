import { useEffect, useRef, useState } from "react";
import type { CrashMapPlace } from "@/lib/crash-place";
import {
  BIKE_LANE_COLOR,
  lanesInBounds,
  loadBundledBikeLanes,
  queryBikeLanes,
  type BikeLane,
} from "@/lib/bike-lanes";
import { BikeLaneToggle } from "@/components/bike-lane-toggle";

type Props = {
  place: CrashMapPlace;
  heading: string;
  markerLabel: string;
};

type LeafletNs = typeof import("leaflet");

type LaneGroup = { clearLayers: () => void };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function paintLanes(leaflet: LeafletNs, group: LaneGroup, lanes: BikeLane[]) {
  group.clearLayers();
  for (const lane of lanes) {
    const latlngs = lane.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]);
    if (latlngs.length < 2) continue;
    leaflet
      .polyline(latlngs, {
        color: "#ffffff",
        weight: 5,
        opacity: 0.9,
        interactive: false,
      })
      .addTo(group as never);
    leaflet
      .polyline(latlngs, {
        color: BIKE_LANE_COLOR,
        weight: 3,
        opacity: 0.95,
        dashArray: "7 5",
        interactive: false,
      })
      .addTo(group as never);
    const mid = latlngs[Math.floor(latlngs.length / 2)];
    leaflet
      .circleMarker(mid, {
        radius: 4,
        color: "#ffffff",
        weight: 2,
        fillColor: BIKE_LANE_COLOR,
        fillOpacity: 0.95,
        interactive: false,
      })
      .addTo(group as never);
  }
}

export function CrashLocaleMap({ place, heading, markerLabel }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<LeafletNs | null>(null);
  const laneGroupRef = useRef<LaneGroup | null>(null);
  const [mapEpoch, setMapEpoch] = useState(0);
  const [failed, setFailed] = useState(false);
  const [lanesOn, setLanesOn] = useState(true);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    let map: { remove: () => void } | null = null;
    let observer: IntersectionObserver | null = null;
    let frame = 0;

    const start = () => {
      if (cancelled || map) return;
      void (async () => {
        try {
          const loaded = await Promise.all([import("leaflet"), import("leaflet/dist/leaflet.css")]);
          const mod = loaded[0] as LeafletNs & { default?: LeafletNs };
          const leaflet = typeof mod.map === "function" ? mod : (mod.default ?? mod);
          if (cancelled || !hostRef.current || typeof leaflet.map !== "function") return;

          const reduce =
            typeof window.matchMedia === "function" &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          hostRef.current.replaceChildren();
          const created = leaflet.map(hostRef.current, {
            center: [place.latitude, place.longitude],
            zoom: place.zoom,
            scrollWheelZoom: false,
            zoomAnimation: !reduce,
            fadeAnimation: !reduce,
            attributionControl: true,
          });
          if (cancelled) {
            created.remove();
            return;
          }
          map = created;

          leaflet
            .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
              maxZoom: 19,
              attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            })
            .addTo(created);

          const laneGroup = leaflet.layerGroup().addTo(created);
          leafletRef.current = leaflet;
          laneGroupRef.current = laneGroup;

          if (place.showMarker) {
            const icon = leaflet.divIcon({
              className: "crash-pin",
              iconSize: [28, 36],
              iconAnchor: [14, 36],
              popupAnchor: [0, -32],
              html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36" aria-hidden="true"><path fill="#155eab" d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.27 21.73 0 14 0z"/><circle cx="14" cy="14" r="5.5" fill="#38bdf8"/></svg>`,
            });
            leaflet
              .marker([place.latitude, place.longitude], {
                icon,
                title: markerLabel,
                alt: markerLabel,
              })
              .addTo(created)
              .bindPopup(`<strong>${escapeHtml(markerLabel)}</strong>`);
          } else {
            const radius = place.zoom <= 5 ? 900_000 : 280_000;
            leaflet
              .circle([place.latitude, place.longitude], {
                radius,
                color: "#155eab",
                weight: 1.5,
                dashArray: "5 6",
                fillColor: "#38bdf8",
                fillOpacity: 0.12,
                interactive: false,
              })
              .addTo(created);
          }

          setMapEpoch((n) => n + 1);
          frame = window.requestAnimationFrame(() => {
            if (!cancelled) created.invalidateSize();
          });
        } catch (err) {
          console.error("[incident-map]", err);
          if (!cancelled) setFailed(true);
        }
      })();
    };

    if (typeof IntersectionObserver === "undefined") {
      start();
    } else {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            observer?.disconnect();
            observer = null;
            start();
          }
        },
        { rootMargin: "240px 0px" },
      );
      observer.observe(host);
    }

    return () => {
      cancelled = true;
      observer?.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      leafletRef.current = null;
      laneGroupRef.current = null;
      map?.remove();
      map = null;
    };
  }, [place.latitude, place.longitude, place.zoom, place.showMarker, markerLabel]);

  useEffect(() => {
    const leaflet = leafletRef.current;
    const group = laneGroupRef.current;
    if (!leaflet || !group || mapEpoch === 0) return;
    group.clearLayers();
    if (!lanesOn) return;

    const west = place.longitude - 0.05;
    const east = place.longitude + 0.05;
    const south = place.latitude - 0.04;
    const north = place.latitude + 0.04;
    const controller = new AbortController();

    void (async () => {
      let bundled: BikeLane[] = [];
      try {
        const all = await loadBundledBikeLanes(controller.signal);
        bundled = lanesInBounds(all, west, south, east, north);
        if (!controller.signal.aborted && laneGroupRef.current) {
          paintLanes(leaflet, laneGroupRef.current, bundled);
        }
      } catch {
        /* A live Overpass answer can still draw the neighborhood. */
      }
      try {
        const live = await queryBikeLanes({
          west,
          south,
          east,
          north,
          signal: controller.signal,
        });
        if (!controller.signal.aborted && live.length > 0 && laneGroupRef.current) {
          paintLanes(leaflet, laneGroupRef.current, live);
        }
      } catch {
        /* Keep the bundled ways already painted. */
      }
    })();

    return () => controller.abort();
  }, [mapEpoch, lanesOn, place.latitude, place.longitude]);

  const note =
    place.scope === "country"
      ? "Country scale. A town was not filed."
      : place.approximate
        ? "Town scale. The pin is the reported place, not a surveyed crash point."
        : null;

  return (
    <section
      className="relative z-0 min-w-0 overflow-hidden rounded-xl bg-surface shadow-[var(--shadow-border)]"
      aria-label={place.approximate ? `Approximate location, ${heading}` : `Map of ${heading}`}
      data-map-scope={place.scope}
      data-map-zoom={place.zoom}
      data-map-approximate={place.approximate ? "true" : "false"}
      data-map-marker={place.showMarker ? "true" : "false"}
    >
      <div className="px-4 pt-4 sm:px-5">
        <p className="text-[0.6875rem] uppercase tracking-[0.16em] text-subtle">
          {place.approximate ? "Approximate location" : "Local map"}
        </p>
        <h2 className="font-display text-xl text-fg">{heading}</h2>
        {note ? <p className="mt-1 text-sm text-muted">{note}</p> : null}
        <div className="mt-2">
          <BikeLaneToggle on={lanesOn} onChange={setLanesOn} />
        </div>
      </div>
      <div className="relative mt-3 h-64 w-full sm:h-80">
        <div ref={hostRef} className="crash-locale-map h-full w-full bg-cream" />
        {failed ? (
          <p className="absolute inset-0 grid place-items-center px-4 text-center text-sm text-muted">
            Map could not be loaded.
          </p>
        ) : null}
      </div>
    </section>
  );
}
