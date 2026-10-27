import { createFileRoute } from "@tanstack/react-router";
import { TrafficMap } from "@/components/traffic-map";

export const Route = createFileRoute("/traffic")({
  component: TrafficPage,
  head: () => ({
    meta: [
      { title: "Traffic volume and speed · Cycling Fatalities Tracker" },
      {
        name: "description",
        content:
          "Explore FHWA traffic volume and posted speed limits on US roads, colored by the upper 20% of the sections in view.",
      },
    ],
  }),
});

function TrafficPage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="text-[0.6875rem] uppercase tracking-[0.2em] text-subtle">United States</p>
        <h1 className="max-w-3xl font-display text-3xl tracking-tight text-fg sm:text-4xl">
          Traffic volume and speed limits
        </h1>
        <p className="max-w-2xl text-muted">
          Compare local roads before reading a route as calm or hostile. Each section shows
          annual average daily traffic and the posted speed limit. Color is relative to the
          sections currently on the map.
        </p>
      </header>

      <TrafficMap />

      <section className="max-w-2xl space-y-3 text-sm leading-relaxed text-muted">
        <h2 className="font-display text-2xl text-fg">Where the numbers come from</h2>
        <p>
          Sections are from the Federal Highway Administration Highway Performance Monitoring
          System, published as state layers on{" "}
          <a
            className="text-accent underline-offset-4 hover:underline"
            href="https://geo.dot.gov/server/rest/services/Hosted/"
          >
            geo.dot.gov
          </a>
          . The fields used here are <span className="text-fg">aadt</span> (annual average daily
          traffic) and <span className="text-fg">speed_limit</span> (posted miles per hour). The
          map opens on a sample of 2023 state submissions for places on this desk, including
          Lancaster County, stored
          in <span className="text-fg">public/traffic-corridors.json</span>. Zooming into a state
          asks that state’s FeatureServer for a fresh sample: up to 40 sections in each of three
          volume bands, simplified with <span className="text-fg">maxAllowableOffset</span> so the
          public service can answer.
        </p>
        <p>
          HPMS covers federal-aid roads — interstates, arterials, and many collectors — not every
          residential block. A quiet side street can be missing even when the arterial next to it
          is drawn. Colors compare only the sections in the current frame. A road that is green
          in a fast city can be orange where the surrounding sections are slower.
        </p>
        <p>
          A later HPMS year, or a state DOT extract with the same two fields, plugs in without
          changing the color rules. Point the map at{" "}
          <span className="text-fg">HPMS_FULL_&#123;ST&#125;_&#123;YEAR&#125;</span> on the same
          host, or replace the bundled file. <span className="text-fg">scripts/fetch-hpms-corridors.py</span>{" "}
          rebuilds that file from the 2023 layers. High stays “at or above the 80th percentile of
          sections drawn”: red when volume and speed are both high, orange when one of them is,
          green when speed is low and volume is low. Dashed teal lines are dedicated bike lanes
          from OpenStreetMap (a cycleway, bike lane, or separated track — shared-lane markings
          are left out). They are on by default and sit apart from the red, orange, and green
          volume colors. <span className="text-fg">scripts/fetch-bike-lanes.py</span> refreshes
          the bundled lanes in <span className="text-fg">public/bike-lanes.json</span>; a close
          map can also ask Overpass for the frame in view.
        </p>
      </section>
    </div>
  );
}
