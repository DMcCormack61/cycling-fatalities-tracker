create table if not exists crashes (
  id text primary key,
  title text not null,
  location_name text not null,
  occurred_on date not null,
  country text not null default 'United States',
  country_code text not null default 'USA',
  state text not null,
  state_code text not null,
  city text not null,
  region text not null,
  latitude double precision,
  longitude double precision,
  crash_type text not null,
  outcome text not null,
  severity text not null,
  fatalities integer not null default 0,
  injured integer not null default 0,
  victim_name text,
  victim_age_band text,
  driver_status text,
  vehicle_type text,
  roadway_type text,
  lighting text,
  helmet text,
  police_report_id text,
  summary text not null,
  context text,
  source_name text not null,
  source_url text,
  verified boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists crashes_occurred_on_idx on crashes (occurred_on desc);
create index if not exists crashes_region_idx on crashes (region);
create index if not exists crashes_type_idx on crashes (crash_type);
create index if not exists crashes_state_idx on crashes (state);
create index if not exists crashes_outcome_idx on crashes (outcome);
