-- Coordinates may be omitted on future filings. Town/state maps are resolved
-- at read time; optional approx_* columns store an explicit or once-geocoded fallback.
alter table crashes alter column latitude drop not null;
alter table crashes alter column longitude drop not null;

alter table crashes add column if not exists approx_latitude double precision;
alter table crashes add column if not exists approx_longitude double precision;
alter table crashes add column if not exists approx_zoom integer;
alter table crashes add column if not exists location_precision text;

create table if not exists place_geocode_cache (
  cache_key text primary key,
  latitude double precision not null,
  longitude double precision not null,
  created_at timestamptz not null default now()
);
