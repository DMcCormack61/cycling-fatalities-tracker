# Bicycle-Automotive Collisions

Vite + TanStack Start app. Domain: US bicycle-automotive collisions (`crashes` table / routes).

- Local DB: PGLite when `DATABASE_URL` unset
- Seed: `src/lib/crashes-seed.ts` (curated public US bicycle-automotive collisions; mirrored by `migrations/0004_real_crash_seed.sql`)
- Theme: blue-dominant tokens in `src/styles.css`
- Traffic: `/traffic` uses FHWA HPMS AADT + posted speed (`geo.dot.gov`), with a bundled sample in `public/traffic-corridors.json`
- Bike lanes: OpenStreetMap dedicated cycleways in `public/bike-lanes.json`, drawn on every map (teal, on by default)
