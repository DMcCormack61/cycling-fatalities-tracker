import { createFileRoute, Link } from "@tanstack/react-router";
import { CrashAtlas } from "@/components/crash-atlas";
import { getDashboard } from "@/lib/crashes-server";
import { REGIONS } from "@/lib/crashes";
import { formatCompact } from "@/lib/format";

export const Route = createFileRoute("/states")({
  loader: () => getDashboard(),
  component: States,
});

function States() {
  const data = Route.useLoaderData();
  const byRegion = new Map(data.byRegion.map((r) => [r.region, r]));

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="text-[0.6875rem] uppercase tracking-[0.2em] text-subtle">
          United States
        </p>
        <h1 className="font-display text-3xl tracking-tight text-fg">
          Census regions and states
        </h1>
        <p className="max-w-2xl text-muted">
          The four US Census regions, and every state that appears in this curated file.
          Counts are publicly reported cases on this desk, not NHTSA or state crash totals.
          Open a region or state to read the filings there.
        </p>
      </header>

      <CrashAtlas points={data.mapPoints} />

      <div className="grid gap-3 sm:grid-cols-2">
        {REGIONS.map((region) => {
          const stat = byRegion.get(region);
          const crashes = stat?.crashes ?? 0;
          const fatalities = stat?.fatalities ?? 0;
          return (
            <Link
              key={region}
              to="/crashes"
              search={{ region }}
              className="rounded-xl bg-surface p-5 shadow-[var(--shadow-border)] transition-[box-shadow] duration-150 hover:shadow-[var(--shadow-border-hover)]"
            >
              <p className="font-display text-xl text-fg">{region}</p>
              <p className="mt-2 text-sm text-muted">
                <span className="tabular-nums text-fg">{formatCompact(crashes)}</span>{" "}
                {crashes === 1 ? "crash" : "crashes"}
                <span className="text-subtle"> · </span>
                <span className="tabular-nums">{formatCompact(fatalities)}</span> killed
              </p>
            </Link>
          );
        })}
      </div>

      <section>
        <h2 className="font-display text-xl text-fg">States with a filing</h2>
        <div className="mt-4 divide-y divide-border rounded-xl bg-surface shadow-[var(--shadow-border)]">
          {data.byState.map((s) => (
            <Link
              key={s.state}
              to="/crashes"
              search={{ state: s.state }}
              className="flex items-baseline justify-between gap-4 px-4 py-3 text-sm hover:bg-elevated"
            >
              <span className="text-fg">
                {s.state}{" "}
                <span className="text-subtle">({s.stateCode})</span>
              </span>
              <span className="tabular-nums text-muted">
                {formatCompact(s.crashes)} filed · {formatCompact(s.fatalities)} killed
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
