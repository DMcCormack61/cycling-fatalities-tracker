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
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

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
  const [lanesOn, setLanesOn] = useState(true);
  const [lanes, setLanes] = useState<BikeLane[]>([]);
  const activeId = hover ?? highlightId ?? null;
  const active = useMemo(
    () => points.find((p) => p.id === activeId) ?? null,
    [points, activeId],
  );

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
        <p className="tabular-nums text-xs text-muted">{points.length} plotted</p>
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
          {points.map((p) => {
            const { x, y } = projectUs(p.latitude, p.longitude);
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
          <div className="pointer-events-none absolute left-3 right-3 top-3 max-w-sm rounded-lg bg-surface/95 p-3 shadow-[var(--shadow-border)] sm:left-4">
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
        <span>Lower 48 · Alaska · Hawaii</span>
        <Legend swatch="bg-critical" label="Killed" />
        <Legend swatch="bg-high" label="Serious injury" />
        <Legend swatch="bg-moderate" label="Moderate" />
        <Legend swatch="bg-gold" label="Lower severity" />
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
