import { createServerFn } from "@tanstack/react-start";
import { getSql, type Sql } from "@/lib/db";
import {
  mapCrash,
  type Crash,
  type CrashFilters,
  type CrashRow,
} from "@/lib/crashes";
import { CRASH_SEED } from "@/lib/crashes-seed";
import {
  finiteCoord,
  realCoords,
  resolveCrashMapPlaceSync,
  TOWN_ZOOM,
  type CrashMapPlace,
} from "@/lib/crash-place";
import { lookupTown } from "@/lib/place-geocode.server";

type SeedRow = (typeof CRASH_SEED)[number];

async function insertCrash(sql: Sql, row: SeedRow): Promise<void> {
  await sql`
    insert into crashes (
      id, title, location_name, occurred_on, country, country_code, state, state_code,
      city, region, latitude, longitude, crash_type, outcome, severity, fatalities, injured,
      victim_name, victim_age_band, driver_status, vehicle_type, roadway_type, lighting,
      helmet, police_report_id, summary, context, source_name, source_url, verified,
      approx_latitude, approx_longitude, approx_zoom, location_precision, ingest_source, review_status
    ) values (
      ${row.id}, ${row.title}, ${row.locationName}, ${row.occurredOn}::date,
      ${row.country}, ${row.countryCode}, ${row.state}, ${row.stateCode},
      ${row.city}, ${row.region},
      ${row.latitude ?? null}, ${row.longitude ?? null}, ${row.crashType}, ${row.outcome},
      ${row.severity}, ${row.fatalities}, ${row.injured},
      ${row.victimName}, ${row.victimAgeBand}, ${row.driverStatus}, ${row.vehicleType},
      ${row.roadwayType}, ${row.lighting}, ${row.helmet}, ${row.policeReportId},
      ${row.summary}, ${row.context}, ${row.sourceName}, ${row.sourceUrl}, true,
      ${row.approxLatitude ?? null}, ${row.approxLongitude ?? null},
      ${row.approxZoom ?? null}, ${row.locationPrecision ?? null}, 'curated', 'published'
    )
    on conflict (id) do update set
      title = excluded.title,
      location_name = excluded.location_name,
      occurred_on = excluded.occurred_on,
      country = excluded.country,
      country_code = excluded.country_code,
      state = excluded.state,
      state_code = excluded.state_code,
      city = excluded.city,
      region = excluded.region,
      latitude = excluded.latitude,
      longitude = excluded.longitude,
      crash_type = excluded.crash_type,
      outcome = excluded.outcome,
      severity = excluded.severity,
      fatalities = excluded.fatalities,
      injured = excluded.injured,
      victim_name = excluded.victim_name,
      victim_age_band = excluded.victim_age_band,
      driver_status = excluded.driver_status,
      vehicle_type = excluded.vehicle_type,
      roadway_type = excluded.roadway_type,
      lighting = excluded.lighting,
      helmet = excluded.helmet,
      police_report_id = excluded.police_report_id,
      summary = excluded.summary,
      context = excluded.context,
      source_name = excluded.source_name,
      source_url = excluded.source_url,
      verified = excluded.verified,
      approx_latitude = excluded.approx_latitude,
      approx_longitude = excluded.approx_longitude,
      approx_zoom = excluded.approx_zoom,
      location_precision = excluded.location_precision,
      ingest_source = excluded.ingest_source,
      review_status = excluded.review_status
  `;
}

/** Drop fictional sample rows, then upsert the curated public-report seed. */
async function ensureCuratedSeed(): Promise<void> {
  const sql = await getSql();
  await sql`
    delete from crashes
    where id like 'sample-%'
      or source_name = 'Sample seed'
      or summary like '%[SAMPLE / DEMO]%'
  `;
  for (const row of CRASH_SEED) {
    await insertCrash(sql, row);
  }
}

export type MapPoint = {
  id: string;
  title: string;
  city: string;
  country: string;
  state: string;
  occurredOn: string;
  crashType: string;
  outcome: string;
  severity: string;
  fatalities: number;
  injured: number;
  latitude: number;
  longitude: number;
  ingestSource: string | null;
  victimName: string | null;
};

export type RegionStat = { region: string; crashes: number; fatalities: number; injured: number };
export type TypeStat = { type: string; crashes: number };
export type YearStat = { year: number; crashes: number; fatalities: number };
export type StateStat = {
  state: string;
  stateCode: string;
  crashes: number;
  fatalities: number;
  injured: number;
};

export type DashboardData = {
  totals: {
    crashes: number;
    fatalities: number;
    injured: number;
    states: number;
    last12Months: number;
    killed: number;
    seriousInjury: number;
    curated: number;
    fars: number;
    penndot: number;
    newsPending: number;
  };
  recent: Crash[];
  mapPoints: MapPoint[];
  byRegion: RegionStat[];
  byType: TypeStat[];
  byYear: YearStat[];
  byState: StateStat[];
};

export const getDashboard = createServerFn({ method: "GET" }).handler(
  async (): Promise<DashboardData> => {
    await ensureCuratedSeed();
    const sql = await getSql();

    const [totals] = await sql<{
      crashes: number;
      fatalities: number;
      injured: number;
      states: number;
      last12: number;
      killed: number;
      serious: number;
      curated: number;
      fars: number;
      penndot: number;
      newsPending: number;
    }>`
      select
        count(*) filter (where verified)::int as crashes,
        coalesce(sum(fatalities) filter (where verified), 0)::int as fatalities,
        coalesce(sum(injured) filter (where verified), 0)::int as injured,
        count(distinct state) filter (where verified)::int as states,
        count(*) filter (where verified and occurred_on >= (current_date - interval '12 months'))::int as last12,
        count(*) filter (where verified and outcome = 'killed')::int as killed,
        count(*) filter (where verified and outcome = 'serious_injury')::int as serious,
        count(*) filter (where verified and ingest_source = 'curated')::int as curated,
        count(*) filter (where verified and ingest_source = 'fars')::int as fars,
        count(*) filter (where verified and ingest_source = 'penndot')::int as penndot,
        count(*) filter (where review_status = 'pending')::int as "newsPending"
      from crashes
    `;

    const recentRows = await sql<CrashRow>`
      select id, title, location_name, occurred_on, country, country_code, state, state_code,
        city, region, latitude, longitude, crash_type, outcome, severity, fatalities, injured,
        victim_name, victim_age_band, driver_status, vehicle_type, roadway_type, lighting,
        helmet, police_report_id, summary, context, source_name, source_url, verified,
        approx_latitude, approx_longitude, approx_zoom, location_precision,
        ingest_source, review_status
      from crashes
      where verified
      order by occurred_on desc,
        case ingest_source when 'curated' then 0 when 'news' then 1 else 2 end,
        id
      limit 8
    `;

    const points = await sql<{
      id: string;
      title: string;
      city: string;
      country: string;
      state: string;
      occurredOn: string;
      crashType: string;
      outcome: string;
      severity: string;
      fatalities: number;
      injured: number;
      latitude: number | null;
      longitude: number | null;
      ingestSource: string | null;
      victimName: string | null;
    }>`
      select id, title, city, country, state, occurred_on as "occurredOn",
        crash_type as "crashType", outcome, severity, fatalities, injured,
        latitude, longitude, ingest_source as "ingestSource", victim_name as "victimName"
      from crashes
      where verified
      order by occurred_on desc
    `;

    const byRegion = await sql<RegionStat>`
      select region, count(*)::int as crashes,
        coalesce(sum(fatalities), 0)::int as fatalities,
        coalesce(sum(injured), 0)::int as injured
      from crashes
      where verified
      group by region
      order by crashes desc
    `;

    const byType = await sql<TypeStat>`
      select crash_type as type, count(*)::int as crashes
      from crashes
      where verified
      group by crash_type
      order by crashes desc
    `;

    const byYear = await sql<YearStat>`
      select extract(year from occurred_on)::int as year,
        count(*)::int as crashes,
        coalesce(sum(fatalities), 0)::int as fatalities
      from crashes
      where verified
      group by 1
      order by 1
    `;

    const byState = await sql<StateStat>`
      select state, state_code as "stateCode",
        count(*)::int as crashes,
        coalesce(sum(fatalities), 0)::int as fatalities,
        coalesce(sum(injured), 0)::int as injured
      from crashes
      where verified
      group by state, state_code
      order by fatalities desc, crashes desc
    `;

    return {
      totals: {
        crashes: totals?.crashes ?? 0,
        fatalities: totals?.fatalities ?? 0,
        injured: totals?.injured ?? 0,
        states: totals?.states ?? 0,
        last12Months: totals?.last12 ?? 0,
        killed: totals?.killed ?? 0,
        seriousInjury: totals?.serious ?? 0,
        curated: totals?.curated ?? 0,
        fars: totals?.fars ?? 0,
        penndot: totals?.penndot ?? 0,
        newsPending: totals?.newsPending ?? 0,
      },
      recent: recentRows.map(mapCrash),
      mapPoints: points.flatMap((p) => {
        const point = realCoords(finiteCoord(p.latitude), finiteCoord(p.longitude));
        if (!point) return [];
        return [
          {
            id: p.id,
            title: p.title,
            city: p.city,
            country: p.country,
            state: p.state,
            occurredOn: p.occurredOn,
            crashType: p.crashType,
            outcome: p.outcome,
            severity: p.severity,
            fatalities: Number(p.fatalities),
            injured: Number(p.injured),
            ingestSource: p.ingestSource,
            victimName: p.victimName,
            latitude: point.latitude,
            longitude: point.longitude,
          },
        ];
      }),
      byRegion,
      byType,
      byYear,
      byState,
    };
  },
);

export type CrashPage = {
  crashes: Crash[];
  total: number;
  page: number;
  pageSize: number;
};

const PAGE_SIZE = 40;

export const listCrashes = createServerFn({ method: "GET" })
  .validator((input: CrashFilters) => input)
  .handler(async ({ data }): Promise<CrashPage> => {
    await ensureCuratedSeed();
    const sql = await getSql();
    const q = data.q?.trim().toLowerCase() ?? "";
    const region = data.region || "";
    const type = data.type || "";
    const outcome = data.outcome || "";
    const severity = data.severity || "";
    const year = data.year || "";
    const state = data.state || "";
    const source = data.source || "";
    const queue = data.queue === "pending" || data.queue === "all" ? data.queue : "";
    const requested = Math.max(1, Number(data.p) || 1);
    const offset = (requested - 1) * PAGE_SIZE;

    const [count] = await sql<{ total: number }>`
      select count(*)::int as total
      from crashes
      where
        (${q} = '' or lower(title) like ${"%" + q + "%"}
          or lower(city) like ${"%" + q + "%"}
          or lower(state) like ${"%" + q + "%"}
          or lower(location_name) like ${"%" + q + "%"}
          or lower(coalesce(victim_name, '')) like ${"%" + q + "%"}
          or lower(summary) like ${"%" + q + "%"})
        and (${region} = '' or region = ${region})
        and (${type} = '' or crash_type = ${type})
        and (${outcome} = '' or outcome = ${outcome})
        and (${severity} = '' or severity = ${severity})
        and (${year} = '' or extract(year from occurred_on)::text = ${year})
        and (${state} = '' or state = ${state})
        and (${source} = '' or ingest_source = ${source})
        and (
          (${queue} = 'all' and review_status <> 'rejected')
          or (${queue} = 'pending' and review_status = 'pending')
          or (${queue} = '' and verified and review_status = 'published')
        )
    `;

    const rows = await sql<CrashRow>`
      select id, title, location_name, occurred_on, country, country_code, state, state_code,
        city, region, latitude, longitude, crash_type, outcome, severity, fatalities, injured,
        victim_name, victim_age_band, driver_status, vehicle_type, roadway_type, lighting,
        helmet, police_report_id, summary, context, source_name, source_url, verified,
        approx_latitude, approx_longitude, approx_zoom, location_precision,
        ingest_source, review_status
      from crashes
      where
        (${q} = '' or lower(title) like ${"%" + q + "%"}
          or lower(city) like ${"%" + q + "%"}
          or lower(state) like ${"%" + q + "%"}
          or lower(location_name) like ${"%" + q + "%"}
          or lower(coalesce(victim_name, '')) like ${"%" + q + "%"}
          or lower(summary) like ${"%" + q + "%"})
        and (${region} = '' or region = ${region})
        and (${type} = '' or crash_type = ${type})
        and (${outcome} = '' or outcome = ${outcome})
        and (${severity} = '' or severity = ${severity})
        and (${year} = '' or extract(year from occurred_on)::text = ${year})
        and (${state} = '' or state = ${state})
        and (${source} = '' or ingest_source = ${source})
        and (
          (${queue} = 'all' and review_status <> 'rejected')
          or (${queue} = 'pending' and review_status = 'pending')
          or (${queue} = '' and verified and review_status = 'published')
        )
      order by occurred_on desc,
        case ingest_source when 'curated' then 0 when 'news' then 1 when 'fars' then 2 else 3 end,
        id
      limit ${PAGE_SIZE} offset ${offset}
    `;
    return {
      crashes: rows.map(mapCrash),
      total: count?.total ?? 0,
      page: requested,
      pageSize: PAGE_SIZE,
    };
  });

export type CrashFile = Crash & { mapPlace: CrashMapPlace | null };

async function withMapPlace(sql: Sql, crash: Crash): Promise<CrashFile> {
  const sync = resolveCrashMapPlaceSync(crash);
  if (!sync.geocode) return { ...crash, mapPlace: sync.place };

  const town = await lookupTown(sql, sync.geocode.city, sync.geocode.country);
  if (!town) return { ...crash, mapPlace: sync.place };

  await sql`
    update crashes
    set approx_latitude = ${town.latitude},
        approx_longitude = ${town.longitude},
        approx_zoom = ${TOWN_ZOOM},
        location_precision = 'town'
    where id = ${crash.id}
      and latitude is null
      and approx_latitude is null
  `;

  return {
    ...crash,
    approxLatitude: crash.approxLatitude ?? town.latitude,
    approxLongitude: crash.approxLongitude ?? town.longitude,
    approxZoom: crash.approxZoom ?? TOWN_ZOOM,
    locationPrecision: crash.locationPrecision ?? "town",
    mapPlace: {
      latitude: town.latitude,
      longitude: town.longitude,
      zoom: TOWN_ZOOM,
      showMarker: true,
      approximate: true,
      scope: "town",
    },
  };
}

export const getCrash = createServerFn({ method: "GET" })
  .validator((id: string) => id)
  .handler(async ({ data: id }): Promise<CrashFile | null> => {
    await ensureCuratedSeed();
    const sql = await getSql();
    const rows = await sql<CrashRow>`
      select id, title, location_name, occurred_on, country, country_code, state, state_code,
        city, region, latitude, longitude, crash_type, outcome, severity, fatalities, injured,
        victim_name, victim_age_band, driver_status, vehicle_type, roadway_type, lighting,
        helmet, police_report_id, summary, context, source_name, source_url, verified,
        approx_latitude, approx_longitude, approx_zoom, location_precision,
        ingest_source, review_status
      from crashes
      where id = ${id}
      limit 1
    `;
    return rows[0] ? withMapPlace(sql, mapCrash(rows[0])) : null;
  });

export const listYears = createServerFn({ method: "GET" }).handler(async (): Promise<number[]> => {
  await ensureCuratedSeed();
  const sql = await getSql();
  const rows = await sql<{ year: number }>`
      select distinct extract(year from occurred_on)::int as year
      from crashes
      where review_status <> 'rejected'
      order by year desc
    `;
  return rows.map((r) => r.year);
});

export const listStates = createServerFn({ method: "GET" }).handler(
  async (): Promise<string[]> => {
    await ensureCuratedSeed();
    const sql = await getSql();
    const rows = await sql<{ state: string }>`
      select distinct state from crashes
      where review_status <> 'rejected'
      order by state
    `;
    return rows.map((r) => r.state);
  },
);
