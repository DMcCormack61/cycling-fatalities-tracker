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

v1 uses a curated sample seed of fictional US crashes so the UI boots. Labelled as sample/demo data in the briefing.

## Later

- Connect Neon (`DATABASE_URL`) and Vercel
- Replace sample seed with verified filings
- Optional admin create/edit UI
