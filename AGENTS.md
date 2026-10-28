# Bicycle-Automotive Collisions

Vite + TanStack Start app. Domain: US bicycle-automotive collisions (`crashes` table / routes).

- Local DB: PGLite when `DATABASE_URL` unset
- Seed: `src/lib/crashes-seed.ts` (curated public US bicycle-automotive collisions; mirrored by `migrations/0004_real_crash_seed.sql`)
- Theme: blue-dominant tokens in `src/styles.css`
- Traffic: `/traffic` uses FHWA HPMS AADT + posted speed (`geo.dot.gov`) outside Lancaster County. Lancaster County uses PennDOT RMS volumes, posted speed, and shoulder width, plus the local-road inventory (`scripts/fetch-penndot-lancaster.py`, bundled in `public/traffic-corridors.json`). Clicking a segment opens name, vehicles per day, posted speed, and shoulder width when published. Lancaster colors: red is still both volume and speed in the upper 20%; amber if shoulder is under 2 ft, speed is over 40 mph, or volume is over 1,000; volume under 400 is green only when amber and red do not apply.
- Bike lanes: OpenStreetMap dedicated cycleways in `public/bike-lanes.json`, drawn on every map (teal, on by default)
