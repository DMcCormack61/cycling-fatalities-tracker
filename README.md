# Bicycle-Automotive Collisions

United States record of crashes between people on bicycles and motor vehicles.

Scaffolded from the Sanctuary Shield Incident Desk app shape (Vite + TanStack Start + PGLite/Postgres), with a distinct blue-dominant theme and a `crashes` data model. **No Sanctuary seed content or church branding is included.**

## Routes

- `/` — Overview
- `/crashes` — Ledger + filters
- `/crashes/$id` — Crash detail
- `/states` — Census regions + states
- `/traffic` — traffic volume and posted speed limits (PennDOT in Lancaster County, FHWA HPMS elsewhere)
- `/briefing` — How to read the desk

## Local

```bash
npm install
npm run db:migrate   # applies SQL migrations (PGLite or DATABASE_URL)
npm run dev          # http://localhost:8080
```

The desk ships with three official layers plus a news queue. Curated named reports stay in `src/lib/crashes-seed.ts` (and `migrations/0004_real_crash_seed.sql` / `0005_lancaster_county_crash.sql`). When a curated filing is the same crash as a bulk row, the named report is kept.

`data/crash-imports/` holds the bulk files. `npm run build` runs `db:migrate`, which applies SQL and then loads these files when `DATABASE_URL` is set. With no database URL, PGLite loads them at startup. A content hash skips a second load.

| Source | What is imported | Rows in this snapshot | In the totals |
| --- | --- | --- | --- |
| NHTSA FARS 2022–2024 | US pedalcyclist fatalities (`PER_TYP` 6 and 7, fatal injury). 2024 is the latest complete annual file (1,103). | 3,393 before overlap removal; 3,387 loaded after 6 curated matches were dropped | Yes. No victim names. |
| PennDOT 2022–2025 | Pennsylvania bicycle crashes with a bicyclist death or any injury, statewide. 934 of the raw rows are in the Lancaster traffic region (Lancaster, York, Dauphin, Lebanon, Berks, Chester). | 4,640 before overlap removal; 4,578 loaded after 1 curated match and 61 FARS death matches were dropped | Yes. Month precision. No victim names. |
| News | Headlines for “cyclist killed”, “bicyclist killed”, “bicyclist struck”, “bicycle crash” injured, and “cyclist injured”. | 9 pending in this snapshot | No, until promoted. |

2025 NHTSA early estimates (Crash Stats) are a national percentage change for pedalcyclists, not a person file. The Crash API cannot return a census without an exact age, sex, seat, and injury. Those estimates are not filed as crashes.

Refresh:

```bash
python3 scripts/fetch-fars-cyclists.py
python3 scripts/fetch-penndot-bike.py
node scripts/fetch-news-crashes.mjs
node scripts/load-crash-imports.mjs
```

Promote or reject one news row (writes `data/crash-imports/news.json`, and the database when `DATABASE_URL` is set):

```bash
node scripts/promote-news-crash.mjs news-<id>
node scripts/promote-news-crash.mjs news-<id> --reject
```

The crashes list is paged. The national map clusters nearby filings. Unreviewed news is at `/crashes?queue=pending`.

Traffic volume is a separate map at `/traffic`. Jump targets include the desk cities and the Lancaster region, which opens on Lancaster County and the Pennsylvania counties that border it. Most places carry annual average daily traffic and posted speed from the FHWA Highway Performance Monitoring System ([geo.dot.gov](https://geo.dot.gov/server/rest/services/Hosted/) state FeatureServers). The Lancaster region replaces that federal-aid sample with PennDOT open data for Lancaster County and the Pennsylvania counties that border it (York, Dauphin, Lebanon, Berks, and Chester): RMS state-route volumes joined to posted speed and shoulder width, plus the Pennsylvania local-road inventory where a volume and a line were published ([gis.penndot.gov](https://gis.penndot.gov/gis/rest/services/opendata/roadwaysegments/MapServer)). Cecil and Harford counties, Maryland, also border Lancaster and are not in this layer. Click a line for the road name, vehicles per day, posted speed, and shoulder width when the record includes it. Outside the Lancaster region, a road is high when its volume or speed is at or above the 80th percentile of the sections drawn: red if both are high, orange if one is, green if both are low. A section with no published speed is colored from volume alone and is not red. In the Lancaster region, PennDOT access control 1 (Limited access) is red, as are FHWA interstate and freeway classes. Volume over 5,000 vehicles per day is red and beats the wide-shoulder cap. Otherwise a shoulder wider than 4 ft with a posted speed under 45 mph stays amber. Speed over 40 mph with volume over 2,000 and under 5,000 and a shoulder under 4 ft is amber. Upper-20% red still applies when those rules do not. A PennDOT section is at least amber when the published shoulder is under 2 ft, posted speed is over 40 mph, or volume is over 1,000 vehicles per day. Volume under 400 is green only when it is not forced amber or red. Those rules apply in all six counties. `public/traffic-corridors.json` holds the saved sections. Refresh other places with `python3 scripts/fetch-hpms-corridors.py` and the Lancaster region with `python3 scripts/fetch-penndot-lancaster.py`. Zooming into a state outside that region queries `HPMS_FULL_{ST}_{YEAR}`. HPMS covers federal-aid roads, not every residential block.

Dedicated bike lanes are drawn on every map (overview, states, traffic, and crash street maps), on by default, in dashed teal so they stay distinct from crash pins and from the red / orange / green volume colors. The source is OpenStreetMap: `highway=cycleway`, or a `cycleway` / `cycleway:left` / `cycleway:right` / `cycleway:both` tag of lane or track. Shared-lane markings are excluded. `public/bike-lanes.json` is the bundled sample; refresh it with `python3 scripts/fetch-bike-lanes.py`. A zoomed-in Leaflet map can also query the public Overpass API for the neighborhood in view.

## Later

- Connect Neon (`DATABASE_URL`) and Vercel
- Optional admin create/edit UI
