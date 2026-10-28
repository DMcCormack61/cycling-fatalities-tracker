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
          Bicycle-Automotive Collisions is a United States record of crashes between people
          on bicycles and motor vehicles. Layout follows an incident-desk pattern: overview,
          ledger, geography, and this briefing.
        </p>
        <p>
          <strong className="text-fg">{DESK_FRAMING.source}.</strong>{" "}
          {DESK_FRAMING.note}
        </p>
      </section>

      <section>
        <h2 className="font-display text-2xl text-fg">What is in — and out</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-muted">
          <li>In: US bicycle-automotive collisions with a death or an injury.</li>
          <li>
            In: NHTSA FARS pedalcyclist fatalities (person type bicyclist or other pedalcyclist)
            from the latest complete annual files, with coordinates when FARS published them.
            FARS does not publish names.
          </li>
          <li>
            In: PennDOT bicycle-involved crashes in Pennsylvania with a bicyclist death or any
            injury, including Lancaster County and the counties that border it. The public
            extract has a month, not a calendar day, and no names.
          </li>
          <li>In: curated filings with a victim name and a news source when one was published.</li>
          <li>
            In, but not in the totals: news headlines in the review queue until they are promoted
            with <span className="font-mono text-xs">scripts/promote-news-crash.mjs</span>.
          </li>
          <li>Out: property-damage-only crashes, unsourced social posts, and invented names or places.</li>
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
