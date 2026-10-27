import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { MapPoint } from "@/lib/crashes-server";
import { WORLD_LAND_PATHS } from "@/lib/world-land-paths";
import { typeLabel } from "@/lib/crashes";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const W = 1000;
const H = 500;

function project(lat: number, lng: number) {
  return {
    x: ((lng + 180) / 360) * W,
    y: ((90 - lat) / 180) * H,
  };
}

const GRATICULE_LNG = [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150];
const GRATICULE_LAT = [-60, -30, 0, 30, 60];

function severityFill(severity: string) {
  if (severity === "critical") return "var(--color-critical)";
  if (severity === "high") return "var(--color-high)";
  if (severity === "moderate") return "var(--color-moderate)";
  return "var(--color-gold)";
}

export function CrashAtlas({
  points,
  highlightId,
}: {
  points: MapPoint[];
  highlightId?: string;
}) {
  const navigate = useNavigate();
  const [hover, setHover] = useState<string | null>(null);
  const activeId = hover ?? highlightId ?? null;
  const active = useMemo(
    () => points.find((p) => p.id === activeId) ?? null,
    [points, activeId],
  );

  return (
    <div className="relative overflow-hidden rounded-xl bg-surface shadow-[var(--shadow-border)]">
      <div className="flex items-center justify-between px-4 pt-4 sm:px-5">
        <div>
          <p className="text-[0.6875rem] uppercase tracking-[0.16em] text-subtle">
            United States
          </p>
          <h2 className="font-display text-xl text-fg">Where KSI crashes were filed</h2>
        </div>
        <p className="tabular-nums text-xs text-muted">{points.length} plotted</p>
      </div>

      <div className="relative mt-3 aspect-[2/1] w-full bg-cream">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-full w-full"
          role="img"
          aria-label="Map of US cycling KSI crashes"
        >
          <rect width={W} height={H} fill="var(--color-cream)" />
          {GRATICULE_LNG.map((lng) => {
            const x = project(0, lng).x;
            return (
              <line
                key={`lng-${lng}`}
                x1={x}
                y1={0}
                x2={x}
                y2={H}
                stroke="var(--color-navy)"
                strokeOpacity={lng === 0 ? 0.16 : 0.07}
                strokeWidth={1}
              />
            );
          })}
          {GRATICULE_LAT.map((lat) => {
            const y = project(lat, 0).y;
            return (
              <line
                key={`lat-${lat}`}
                x1={0}
                y1={y}
                x2={W}
                y2={y}
                stroke="var(--color-navy)"
                strokeOpacity={lat === 0 ? 0.16 : 0.07}
                strokeWidth={1}
              />
            );
          })}
          <g
            fill="var(--color-navy)"
            fillOpacity={0.28}
            stroke="var(--color-navy)"
            strokeOpacity={0.55}
            strokeWidth={0.85}
          >
            {WORLD_LAND_PATHS.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </g>
          {points.map((p) => {
            const { x, y } = project(p.latitude, p.longitude);
            const r = p.severity === "critical" ? 7 : p.severity === "high" ? 5.5 : 4.5;
            const isActive = p.id === activeId;
            return (
              <g key={p.id}>
                {p.severity === "critical" ? (
                  <circle
                    cx={x}
                    cy={y}
                    r={r + 7}
                    fill="none"
                    stroke={severityFill(p.severity)}
                    strokeOpacity={0.4}
                    className="origin-center animate-pulse"
                  />
                ) : null}
                <circle
                  cx={x}
                  cy={y}
                  r={isActive ? r + 2 : r}
                  fill={severityFill(p.severity)}
                  fillOpacity={isActive ? 1 : 0.92}
                  stroke="var(--color-surface)"
                  strokeWidth={1.4}
                  className="cursor-pointer"
                  role="link"
                  tabIndex={0}
                  onClick={() =>
                    void navigate({ to: "/crashes/$id", params: { id: p.id } })
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      void navigate({ to: "/crashes/$id", params: { id: p.id } });
                    }
                  }}
                  onMouseEnter={() => setHover(p.id)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(p.id)}
                  onBlur={() => setHover(null)}
                  aria-label={`${p.title} — ${p.city}, ${p.state}`}
                />
              </g>
            );
          })}
        </svg>

        {active ? (
          <div className="pointer-events-none absolute bottom-3 left-3 right-3 max-w-sm rounded-lg bg-surface/95 p-3 shadow-[var(--shadow-border)] sm:left-4">
            <p className="text-[0.6875rem] uppercase tracking-[0.14em] text-subtle">
              {typeLabel(active.crashType)} · {formatDate(active.occurredOn)}
            </p>
            <p className="mt-1 font-display text-base leading-snug text-fg">{active.title}</p>
            <p className="mt-1 text-sm text-muted">
              {active.city}, {active.state}
              {active.fatalities > 0
                ? ` · ${active.fatalities} killed`
                : active.injured > 0
                  ? ` · ${active.injured} serious injury`
                  : ""}
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-4 px-4 py-3 text-[0.6875rem] uppercase tracking-[0.12em] text-subtle sm:px-5">
        <Legend swatch="bg-critical" label="Killed" />
        <Legend swatch="bg-high" label="Serious injury" />
        <Legend swatch="bg-moderate" label="Moderate" />
        <Legend swatch="bg-gold" label="Lower severity" />
      </div>
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={cn("size-2 rounded-full", swatch)} />
      {label}
    </span>
  );
}
