import { createFileRoute, Link } from "@tanstack/react-router";
import { DESK_FRAMING } from "@/lib/crashes";

export const Route = createFileRoute("/briefing")({
  component: Briefing,
});

function Briefing() {
  return (
    <article className="mx-auto flex max-w-2xl flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="text-[0.6875rem] uppercase tracking-[0.2em] text-subtle">Briefing</p>
        <h1 className="font-display text-3xl tracking-tight text-fg">How to read this desk</h1>
      </header>

      <section className="space-y-3 text-base leading-relaxed text-muted">
        <p className="text-fg">
          The Cycling Fatalities Tracker is a US-wide KSI (killed or serious injury) desk for
          cyclists struck by drivers. Layout follows an incident-desk pattern: overview, ledger,
          geography, and this briefing.
        </p>
        <p>
          <strong className="text-fg">{DESK_FRAMING.source}.</strong>{" "}
          {DESK_FRAMING.note}
        </p>
      </section>

      <section>
        <h2 className="font-display text-2xl text-fg">What is in — and out</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-muted">
          <li>In: US crashes where a cyclist was killed or seriously injured by a motor vehicle.</li>
          <li>In: curated filings with date, place, mechanism, outcome, and a named source.</li>
          <li>In: victim name when known (optional when withheld).</li>
          <li>Out: property-only scrapes, unsourced social posts, and non-US geography (v1).</li>
          <li>Out: create/edit admin UI — seed file only for now.</li>
        </ul>
      </section>

      <section className="rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
        <h2 className="font-display text-2xl text-fg">Crash types</h2>
        <p className="mt-2 text-sm text-muted">
          Mechanisms used in the ledger: hit-from-behind, right-hook, left-cross, dooring,
          hit-and-run, sidewalk, intersection, other.
        </p>
      </section>

      <section>
        <h2 className="font-display text-2xl text-fg">Geography</h2>
        <p className="mt-3 text-muted">
          Filings are tagged with a US state and a Census Bureau region (Northeast, Midwest,
          South, West). The overview map is the United States — the lower 48, with Alaska and
          Hawaii inset — not a world map. A crash page opens a street map of the reported place.
          The{" "}
          <Link to="/traffic" className="text-accent underline-offset-4 hover:underline">
            Traffic
          </Link>{" "}
          page maps FHWA annual average daily traffic and posted speed limits on federal-aid
          roads, colored against the sections in view: red when both are in the upper 20%, orange
          when only one is, green when speed and volume are both low. Every map also draws
          dedicated bike lanes from OpenStreetMap — cycleways, bike lanes, and separated tracks,
          not shared-lane markings — in teal, on by default.
        </p>
      </section>

      <section>
        <h2 className="font-display text-2xl text-fg">Accounts</h2>
        <p className="mt-3 text-muted">
          The desk is public. Crash files, maps, and this briefing do not require an account.
        </p>
      </section>
    </article>
  );
}
