import { useEffect, useRef, useState } from "react";
import type { CrashMapPlace } from "@/lib/crash-place";

type Props = {
  place: CrashMapPlace;
  heading: string;
  markerLabel: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function CrashLocaleMap({ place, heading, markerLabel }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

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
          const mod = loaded[0] as typeof import("leaflet") & {
            default?: typeof import("leaflet");
          };
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
      map?.remove();
      map = null;
    };
  }, [place.latitude, place.longitude, place.zoom, place.showMarker, markerLabel]);

  const note =
    place.scope === "country"
      ? "Country scale. A town was not filed."
      : place.approximate
        ? "Town scale. Not a confirmed church footprint."
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
