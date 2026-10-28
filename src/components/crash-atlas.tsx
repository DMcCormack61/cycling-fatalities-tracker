import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { MapPoint } from "@/lib/crashes-server";
import {
  projectUs,
  US_ATLAS_HEIGHT,
  US_ATLAS_WIDTH,
  US_INSET_FRAMES,
  US_STATE_SHAPES,
} from "@/lib/us-atlas";
import { BIKE_LANE_COLOR, loadBundledBikeLanes, type BikeLane } from "@/lib/bike-lanes";
import { BikeLaneToggle } from "@/components/bike-lane-toggle";
import { typeLabel } from "@/lib/crashes";
import { formatCompact, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

function severityFill(severity: string) {
  if (severity === "critical") return "var(--color-critical)";
  if (severity === "high") return "var(--color-high)";
  if (severity === "moderate") return "var(--color-moderate)";
  return "var(--color-gold)";
}

type Plot = {
  id: string;
  x: number;
  y: number;
  point: MapPoint;
  count: number;
  fatalities: number;
};

function pickRepresentative(group: MapPoint[]): MapPoint {
  return [...group].sort((a, b) => {
    const named = Number(Boolean(b.victimName)) - Number(Boolean(a.victimName));
    if (named) return named;
    const curated =
      Number(b.ingestSource === "curated") - Number(a.ingestSource === "curated");
    if (curated) return curated;
    if (b.fatalities !== a.fatalities) return b.fatalities - a.fatalities;
    return String(b.occurredOn).localeCompare(String(a.occurredOn));
  })[0];
}

/** Grid-cluster national pins so a few thousand filings stay clickable. */
function clusterPlots(points: MapPoint[], cell = 14): Plot[] {
  const buckets = new Map<string, { gx: number; gy: number; points: MapPoint[] }>();
  const coords = new Map<string, { x: number; y: number }>();
  for (const point of points) {
    const projected = projectUs(point.latitude, point.longitude);
    if (!Number.isFinite(projected.x) || !Number.isFinite(projected.y)) continue;
    coords.set(point.id, projected);
    const gx = Math.round(projected.x / cell);
    const gy = Math.round(projected.y / cell);
    const key = `${gx}:${gy}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.points.push(point);
    else buckets.set(key, { gx, gy, points: [point] });
  }
  const plots: Plot[] = [];
  for (const [key, bucket] of buckets) {
    const point = pickRepresentative(bucket.points);
    const projected = coords.get(point.id);
    const single = bucket.points.length === 1 && projected;
    plots.push({
      id: single ? point.id : key,
      x: single ? projected.x : bucket.gx * cell,
      y: single ? projected.y : bucket.gy * cell,
      point,
      count: bucket.points.length,
      fatalities: bucket.points.reduce((sum, item) => sum + item.fatalities, 0),
    });
  }
  return plots;
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
  const [lanesOn, setLanesOn] = useState(true);
  const [lanes, setLanes] = useState<BikeLane[]>([]);
  const plots = useMemo(() => clusterPlots(points), [points]);
  const activeId = hover ?? highlightId ?? null;
  const active = useMemo(() => {
    const plot = plots.find((item) => item.id === activeId || item.point.id === activeId);
    return plot ?? null;
  }, [plots, activeId]);

  useEffect(() => {
    const controller = new AbortController();
    void loadBundledBikeLanes(controller.signal)
      .then(setLanes)
      .catch(() => {
        /* The atlas still shows crash pins when the lane file is missing. */
      });
    return () => controller.abort();
  }, []);

  const laneMarks = useMemo(() => {
    const cells = new Map<string, { x: number; y: number; n: number }>();
    for (const lane of lanes) {
      const mid = lane.coordinates[Math.floor(lane.coordinates.length / 2)];
      if (!mid) continue;
      const p = projectUs(mid[1], mid[0]);
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
      const gx = Math.round(p.x / 5);
      const gy = Math.round(p.y / 5);
      const key = `${gx}:${gy}`;
      const cell = cells.get(key);
      if (cell) cell.n += 1;
      else cells.set(key, { x: gx * 5, y: gy * 5, n: 1 });
    }
    return [...cells.entries()].map(([id, cell]) => ({
      id,
      x: cell.x,
      y: cell.y,
      r: cell.n >= 8 ? 7.2 : cell.n >= 3 ? 5.4 : 4.2,
    }));
  }, [lanes]);

  return (
    <div className="relative overflow-hidden rounded-xl bg-surface shadow-[var(--shadow-border)]">
      <div className="flex items-center justify-between px-4 pt-4 sm:px-5">
        <div>
          <p className="text-[0.6875rem] uppercase tracking-[0.16em] text-subtle">
            United States
          </p>
          <h2 className="font-display text-xl text-fg">Where collisions were filed</h2>
        </div>
        <p className="tabular-nums text-xs text-muted">
          {formatCompact(points.length)} filed
          {plots.length < points.length ? ` · ${formatCompact(plots.length)} marks` : ""}
        </p>
      </div>

      <div className="relative mt-3 aspect-[25/16] w-full bg-cream">
        <svg
          viewBox={`0 0 ${US_ATLAS_WIDTH} ${US_ATLAS_HEIGHT}`}
          className="h-full w-full"
          role="img"
          aria-label="Map of United States bicycle-automotive collisions"
        >
          <rect width={US_ATLAS_WIDTH} height={US_ATLAS_HEIGHT} fill="var(--color-cream)" />
          {US_INSET_FRAMES.map((frame) => (
            <rect
              key={frame.name}
              x={frame.x}
              y={frame.y}
              width={frame.width}
              height={frame.height}
              rx={8}
              fill="var(--color-surface)"
              stroke="var(--color-navy)"
              strokeOpacity={0.22}
            />
          ))}
          <g
            fill="var(--color-navy)"
            fillOpacity={0.28}
            stroke="var(--color-navy)"
            strokeOpacity={0.55}
            strokeWidth={0.8}
            strokeLinejoin="round"
          >
            {US_STATE_SHAPES.map((state) => (
              <path key={state.name} d={state.d}>
                <title>{state.name}</title>
              </path>
            ))}
          </g>
          {lanesOn
            ? laneMarks.map((lane) => (
                <circle
                  key={lane.id}
                  cx={lane.x}
                  cy={lane.y}
                  r={lane.r}
                  fill={BIKE_LANE_COLOR}
                  stroke="#ffffff"
                  strokeWidth={1.2}
                  pointerEvents="none"
                />
              ))
            : null}
          {US_INSET_FRAMES.map((frame) => (
            <text
              key={`${frame.name}-label`}
              x={frame.x + 10}
              y={frame.y + 18}
              fill="var(--color-navy)"
              fillOpacity={0.7}
              stroke="var(--color-surface)"
              strokeWidth={3}
              paintOrder="stroke"
              fontSize={12}
              fontFamily="ui-sans-serif, system-ui, sans-serif"
            >
              {frame.name}
            </text>
          ))}
          {plots.map((plot) => {
            const r =
              plot.count > 1
                ? Math.min(16, 6 + Math.sqrt(plot.count))
                : plot.point.severity === "critical"
                  ? 7
                  : plot.point.severity === "high"
                    ? 5.5
                    : 4.5;
            const isActive = plot.id === activeId || plot.point.id === activeId;
            const fill = plot.count > 1 ? "var(--color-navy)" : severityFill(plot.point.severity);
            return (
              <g key={plot.id}>
                {plot.count === 1 && plot.point.severity === "critical" ? (
                  <circle
                    cx={plot.x}
                    cy={plot.y}
                    r={r + 7}
                    fill="none"
                    stroke={severityFill(plot.point.severity)}
                    strokeOpacity={0.4}
                    className="origin-center animate-pulse"
                  />
                ) : null}
                <circle
                  cx={plot.x}
                  cy={plot.y}
                  r={isActive ? r + 2 : r}
                  fill={fill}
                  fillOpacity={isActive ? 1 : 0.92}
                  stroke="var(--color-surface)"
                  strokeWidth={1.4}
                  className="cursor-pointer"
                  role="link"
                  tabIndex={0}
                  onClick={() =>
                    void navigate({ to: "/crashes/$id", params: { id: plot.point.id } })
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      void navigate({ to: "/crashes/$id", params: { id: plot.point.id } });
                    }
                  }}
                  onMouseEnter={() => setHover(plot.id)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(plot.id)}
                  onBlur={() => setHover(null)}
                  aria-label={
                    plot.count > 1
                      ? `${plot.count} crashes near ${plot.point.city}, ${plot.point.state}`
                      : `${plot.point.title} — ${plot.point.city}, ${plot.point.state}`
                  }
                />
                {plot.count > 1 ? (
                  <text
                    x={plot.x}
                    y={plot.y + 3}
                    textAnchor="middle"
                    fontSize={8}
                    fill="var(--color-cream)"
                    pointerEvents="none"
                  >
                    {plot.count > 99 ? "99+" : plot.count}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>

        {active ? (
          <div className="pointer-events-none absolute left-3 right-3 top-3 max-w-sm rounded-lg bg-surface/95 p-3 shadow-[var(--shadow-border)] sm:left-4">
            <p className="text-[0.6875rem] uppercase tracking-[0.14em] text-subtle">
              {active.count > 1
                ? `${formatCompact(active.count)} nearby · ${formatCompact(active.fatalities)} killed`
                : `${typeLabel(active.point.crashType)} · ${formatDate(active.point.occurredOn)}`}
            </p>
            <p className="mt-1 font-display text-base leading-snug text-fg">{active.point.title}</p>
            <p className="mt-1 text-sm text-muted">
              {active.point.city}, {active.point.state}
              {active.count === 1 && active.point.fatalities > 0
                ? ` · ${active.point.fatalities} killed`
                : active.count === 1 && active.point.injured > 0
                  ? ` · ${active.point.injured} injured`
                  : ""}
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-4 px-4 py-3 text-[0.6875rem] uppercase tracking-[0.12em] text-subtle sm:px-5">
        <span>Lower 48 · Alaska · Hawaii</span>
        <Legend swatch="bg-critical" label="Killed" />
        <Legend swatch="bg-high" label="Serious injury" />
        <Legend swatch="bg-moderate" label="Moderate" />
        <Legend swatch="bg-navy" label="Cluster" />
        <BikeLaneToggle on={lanesOn} onChange={setLanesOn} />
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
