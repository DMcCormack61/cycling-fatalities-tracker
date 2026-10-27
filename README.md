# Cycling Fatalities Tracker

US-wide KSI (killed / serious injury) desk for cyclists struck by drivers.

Scaffolded from the Sanctuary Shield Incident Desk app shape (Vite + TanStack Start + PGLite/Postgres), with a distinct blue-dominant theme and a `crashes` data model. **No Sanctuary seed content or church branding is included.**

## Routes

- `/` — Overview
- `/crashes` — Ledger + filters
- `/crashes/$id` — Crash detail
- `/states` — Census regions + states
- `/traffic` — FHWA traffic volume and posted speed limits
- `/briefing` — How to read the desk

## Local

```bash
npm install
npm run db:migrate   # applies SQL migrations (PGLite or DATABASE_URL)
npm run dev          # http://localhost:8080
```

The desk ships with a curated seed of publicly reported US cyclist KSI cases (`src/lib/crashes-seed.ts`), each with a victim name when published and a source URL. `migrations/0004_real_crash_seed.sql` deletes the old fictional sample rows and upserts the same cases, so a Neon database picks them up on `npm run build` (`db:migrate` runs on every Vercel deploy). Preview without `DATABASE_URL` applies that migration in PGLite and the server seed upserts the same rows.

Traffic volume is a separate map at `/traffic`. Jump targets include the desk cities and Lancaster County, Pennsylvania, which opens on the county boundary. Segments carry annual average daily traffic and posted speed from the FHWA Highway Performance Monitoring System ([geo.dot.gov](https://geo.dot.gov/server/rest/services/Hosted/) state FeatureServers). A road is high when its volume or speed is at or above the 80th percentile of the sections drawn: red if both are high, orange if one is, green if both are low. `public/traffic-corridors.json` is a 2023 sample so the page still draws corridors when the live service is slow. Refresh it with `python3 scripts/fetch-hpms-corridors.py`. Zooming into a state queries `HPMS_FULL_{ST}_{YEAR}` the same way; a later year or a state DOT file with `aadt` and `speed_limit` can replace that source without changing the color rules. HPMS covers federal-aid roads, not every residential block.

## Later

- Connect Neon (`DATABASE_URL`) and Vercel
- Optional admin create/edit UI
