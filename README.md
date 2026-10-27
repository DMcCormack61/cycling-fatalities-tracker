# Cycling Fatalities Tracker

US-wide KSI (killed / serious injury) desk for cyclists struck by drivers.

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

The desk ships with a curated seed of publicly reported US cyclist KSI cases (`src/lib/crashes-seed.ts`), each with a victim name when published and a source URL. `migrations/0004_real_crash_seed.sql` deletes the old fictional sample rows and upserts the same cases, so a Neon database picks them up on `npm run build` (`db:migrate` runs on every Vercel deploy). Preview without `DATABASE_URL` applies that migration in PGLite and the server seed upserts the same rows.

Traffic volume is a separate map at `/traffic`. Jump targets include the desk cities and Lancaster County, Pennsylvania, which opens on the county boundary. Most places carry annual average daily traffic and posted speed from the FHWA Highway Performance Monitoring System ([geo.dot.gov](https://geo.dot.gov/server/rest/services/Hosted/) state FeatureServers). Lancaster County replaces that federal-aid sample with PennDOT open data: RMS state-route volumes joined to posted speed and shoulder width, plus the Pennsylvania local-road inventory where a volume and a line were published ([gis.penndot.gov](https://gis.penndot.gov/gis/rest/services/opendata/roadwaysegments/MapServer)). Click a line for the road name, vehicles per day, posted speed, and shoulder width when the record includes it. A road is high when its volume or speed is at or above the 80th percentile of the sections drawn: red if both are high, orange if one is, green if both are low. A section with no published speed is colored from volume alone and is not red. `public/traffic-corridors.json` holds the saved sections. Refresh other places with `python3 scripts/fetch-hpms-corridors.py` and Lancaster County with `python3 scripts/fetch-penndot-lancaster.py`. Zooming into a state outside that county queries `HPMS_FULL_{ST}_{YEAR}`. HPMS covers federal-aid roads, not every residential block.

Dedicated bike lanes are drawn on every map (overview, states, traffic, and crash street maps), on by default, in dashed teal so they stay distinct from crash pins and from the red / orange / green volume colors. The source is OpenStreetMap: `highway=cycleway`, or a `cycleway` / `cycleway:left` / `cycleway:right` / `cycleway:both` tag of lane or track. Shared-lane markings are excluded. `public/bike-lanes.json` is the bundled sample; refresh it with `python3 scripts/fetch-bike-lanes.py`. A zoomed-in Leaflet map can also query the public Overpass API for the neighborhood in view.

## Later

- Connect Neon (`DATABASE_URL`) and Vercel
- Optional admin create/edit UI
