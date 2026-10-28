import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { CrashAtlas } from "@/components/crash-atlas";
import { CrashRow } from "@/components/crash-row";
import { YearChart, TypeChart } from "@/components/desk-charts";
import { getDashboard } from "@/lib/crashes-server";
import { DESK_FRAMING } from "@/lib/crashes";
import { formatCompact } from "@/lib/format";

export const Route = createFileRoute("/")({
  loader: () => getDashboard(),
  component: Desk,
});

function Desk() {
  const data = Route.useLoaderData();
  const { totals } = data;

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <p className="text-[0.6875rem] uppercase tracking-[0.2em] text-subtle">
          United States
        </p>
        <h1 className="max-w-3xl font-display text-3xl leading-tight tracking-tight text-fg sm:text-4xl">
          Bicycle-Automotive Collisions
        </h1>
        <p className="max-w-2xl text-base text-muted">
          Cyclist fatalities from NHTSA FARS, Pennsylvania bicycle injuries and deaths from PennDOT,
          and named public reports when a victim was identified.{" "}
          <Link to="/traffic" className="text-accent underline-offset-4 hover:underline">
            Traffic volume
          </Link>{" "}
          shows how busy nearby roads are, and how fast they are posted.
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Crashes filed" value={formatCompact(totals.crashes)} />
        <Kpi label="Killed" value={formatCompact(totals.fatalities)} />
        <Kpi label="Injured" value={formatCompact(totals.injured)} />
        <Kpi label="States" value={formatCompact(totals.states)} />
        <Kpi label="Last 12 months" value={formatCompact(totals.last12Months)} />
        <Kpi label="Collisions" value={formatCompact(totals.killed + totals.seriousInjury)} />
      </section>

      <CrashAtlas points={data.mapPoints} />

      <section className="grid gap-4 lg:grid-cols-5">
        <div className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)] lg:col-span-3">
          <p className="text-[0.6875rem] uppercase tracking-[0.16em] text-subtle">By year</p>
          <h2 className="font-display text-xl text-fg">Volume on the desk</h2>
          <YearChart data={data.byYear} />
        </div>
        <div className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)] lg:col-span-2">
          <p className="text-[0.6875rem] uppercase tracking-[0.16em] text-subtle">By type</p>
          <h2 className="font-display text-xl text-fg">Crash mechanisms</h2>
          <TypeChart data={data.byType} />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-5">
        <div className="rounded-xl bg-surface p-2 shadow-[var(--shadow-border)] lg:col-span-3">
          <div className="flex items-end justify-between px-3 pb-2 pt-3">
            <div>
              <p className="text-[0.6875rem] uppercase tracking-[0.16em] text-subtle">Latest</p>
              <h2 className="font-display text-xl text-fg">Recent crashes</h2>
            </div>
            <Link
              to="/crashes"
              className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg"
            >
              Full list <ArrowRight className="size-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-border">
            {data.recent.map((c) => (
              <CrashRow key={c.id} crash={c} />
            ))}
          </div>
        </div>

        <aside className="flex flex-col gap-4 lg:col-span-2">
          <div className="rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
            <p className="text-[0.6875rem] uppercase tracking-[0.16em] text-subtle">
              {DESK_FRAMING.source}
            </p>
            <h2 className="mt-1 font-display text-xl text-fg">About this file</h2>
            <p className="mt-2 text-sm text-muted">{DESK_FRAMING.note}</p>
            <dl className="mt-4 space-y-3">
              <StatLine label="Curated reports" value={formatCompact(totals.curated)} />
              <StatLine label="NHTSA FARS" value={formatCompact(totals.fars)} />
              <StatLine label="PennDOT" value={formatCompact(totals.penndot)} />
              <StatLine
                label="News queue"
                value={formatCompact(totals.newsPending)}
              />
            </dl>
            <Link
              to="/crashes"
              search={{ queue: "pending" }}
              className="mt-4 inline-flex items-center gap-1 text-sm text-accent hover:underline"
            >
              Review news queue <ArrowRight className="size-3.5" />
            </Link>
          </div>

          <div className="rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
            <p className="text-[0.6875rem] uppercase tracking-[0.16em] text-subtle">
              Hardest-hit in this file
            </p>
            <h2 className="mt-1 font-display text-xl text-fg">By fatalities</h2>
            <ol className="mt-4 space-y-2">
              {data.byState.slice(0, 6).map((s, i) => (
                <li key={s.state} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-muted">
                    <span className="mr-2 tabular-nums text-subtle">{i + 1}</span>
                    {s.state}
                  </span>
                  <span className="tabular-nums text-fg">{formatCompact(s.fatalities)}</span>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </section>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface px-3 py-4 shadow-[var(--shadow-border)] sm:px-4">
      <p className="text-[0.6875rem] uppercase tracking-[0.14em] text-subtle">{label}</p>
      <p className="mt-1 font-display text-2xl tabular-nums tracking-tight text-fg sm:text-3xl">
        {value}
      </p>
    </div>
  );
}

function StatLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-border pt-3">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="tabular-nums text-sm text-fg">{value}</dd>
    </div>
  );
}
