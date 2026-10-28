import { createFileRoute } from "@tanstack/react-router";
import { TrafficMap } from "@/components/traffic-map";

export const Route = createFileRoute("/traffic")({
  component: TrafficPage,
  head: () => ({
    meta: [
      { title: "Traffic volume and speed · Bicycle-Automotive Collisions" },
      {
        name: "description",
        content:
          "Explore traffic volume and posted speed limits on US roads. Lancaster County uses PennDOT volumes, with shoulder width when published.",
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
          Most places use the Federal Highway Administration Highway Performance Monitoring
          System, published as state layers on{" "}
          <a
            className="text-accent underline-offset-4 hover:underline"
            href="https://geo.dot.gov/server/rest/services/Hosted/"
          >
            geo.dot.gov
          </a>
          . Those fields are <span className="text-fg">aadt</span> (annual average daily traffic)
          and <span className="text-fg">speed_limit</span> (posted miles per hour). The map opens
          on a sample of 2023 state submissions for places on this desk, stored in{" "}
          <span className="text-fg">public/traffic-corridors.json</span>. Zooming into a state
          asks that state’s FeatureServer for a fresh sample: up to 40 sections in each of three
          volume bands, simplified with <span className="text-fg">maxAllowableOffset</span> so the
          public service can answer.{" "}
          <span className="text-fg">scripts/fetch-hpms-corridors.py</span> rebuilds those places.
        </p>
        <p>
          Lancaster County, Pennsylvania replaces that HPMS sample with PennDOT open data so
          municipal streets appear along with state routes. State routes come from RMS roadway
          segments (<span className="text-fg">CUR_AADT</span> and the street name) on{" "}
          <a
            className="text-accent underline-offset-4 hover:underline"
            href="https://gis.penndot.gov/gis/rest/services/opendata/roadwaysegments/MapServer"
          >
            roadway segments
          </a>
          , joined to{" "}
          <a
            className="text-accent underline-offset-4 hover:underline"
            href="https://gis.penndot.gov/gis/rest/services/opendata/roadwayadmin/MapServer"
          >
            roadway administration
          </a>{" "}
          for the posted speed and to{" "}
          <a
            className="text-accent underline-offset-4 hover:underline"
            href="https://gis.penndot.gov/gis/rest/services/opendata/roadwayshoulder/MapServer"
          >
            roadway shoulder
          </a>{" "}
          for total shoulder width in feet. Local roads come from the{" "}
          <a
            className="text-accent underline-offset-4 hover:underline"
            href="https://gis.penndot.gov/gis/rest/services/opendata/pennsylvanialocalroads/MapServer"
          >
            Pennsylvania local-road inventory
          </a>{" "}
          (estimated average daily traffic and the municipal street name). County code 36.
          PennDOT rarely publishes a speed or a shoulder on those local records. The popup says
          “Not published” for speed and leaves the shoulder row out. On this layer, red is still
          both volume and speed in the upper 20% of the sections drawn. A section is at least amber
          when the published shoulder is under 2 ft (including 0 ft), posted speed is over 40 mph,
          or volume is over 1,000 vehicles per day. Volume under 400 vehicles per day is green only
          when it is not forced amber or red. A missing speed is not red. Records that publish a
          volume but no line are left off the map.{" "}
          <span className="text-fg">scripts/fetch-penndot-lancaster.py</span> refreshes the county
          and leaves the other places in the bundled file.
        </p>
        <p>
          HPMS covers federal-aid roads — interstates, arterials, and many collectors — not every
          residential block. A quiet side street can be missing even when the arterial next to it
          is drawn. Inside Lancaster County the map keeps the PennDOT lines instead of swapping in
          that sparser live sample. Outside Lancaster County, colors compare only the sections in
          the current frame. A road that is green in a fast city can be orange where the surrounding
          sections are slower.
        </p>
        <p>
          Click a colored line to open the road name, vehicles per day, posted speed limit, and
          shoulder width when the source published one. Outside Lancaster County, high stays “at or
          above the 80th percentile of sections drawn”: red when volume and speed are both high,
          orange when one of them is, green when speed is low and volume is low. Dashed teal lines
          are dedicated bike lanes
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
