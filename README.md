# Cycling Fatalities Tracker

US-wide KSI (killed / serious injury) desk for cyclists struck by drivers.

Scaffolded from the Sanctuary Shield Incident Desk app shape (Vite + TanStack Start + PGLite/Postgres), with a distinct blue-dominant theme and a `crashes` data model. **No Sanctuary seed content or church branding is included.**

## Routes

- `/` — Overview
- `/crashes` — Ledger + filters
- `/crashes/$id` — Crash detail
- `/states` — Census regions + states
- `/briefing` — How to read the desk

## Local

```bash
npm install
npm run db:migrate   # applies SQL migrations (PGLite or DATABASE_URL)
npm run dev          # http://localhost:8080
```

The desk ships with a curated seed of publicly reported US cyclist KSI cases (`src/lib/crashes-seed.ts`), each with a victim name when published and a source URL. `migrations/0004_real_crash_seed.sql` deletes the old fictional sample rows and upserts the same cases, so a Neon database picks them up on `npm run build` (`db:migrate` runs on every Vercel deploy). Preview without `DATABASE_URL` applies that migration in PGLite and the server seed upserts the same rows.

## Later

- Connect Neon (`DATABASE_URL`) and Vercel
- Optional admin create/edit UI
