export const REGIONS = [
  "Northeast",
  "Midwest",
  "South",
  "West",
] as const;

export const CRASH_TYPES = [
  "hit-from-behind",
  "right-hook",
  "left-cross",
  "dooring",
  "hit-and-run",
  "sidewalk",
  "intersection",
  "other",
] as const;

export const OUTCOMES = ["killed", "serious_injury"] as const;

export const SEVERITIES = ["critical", "high", "moderate", "low"] as const;

export const DRIVER_STATUSES = [
  "at_scene",
  "fled",
  "charged",
  "unknown",
] as const;

export type Region = (typeof REGIONS)[number];
export type CrashType = (typeof CRASH_TYPES)[number];
export type Outcome = (typeof OUTCOMES)[number];
export type Severity = (typeof SEVERITIES)[number];
export type DriverStatus = (typeof DRIVER_STATUSES)[number];
/** How precise the filed coordinates are. Omitted on older rows. */
export type LocationPrecision = "exact" | "town" | "country";

export type Crash = {
  id: string;
  title: string;
  locationName: string;
  occurredOn: string;
  country: string;
  countryCode: string;
  state: string;
  stateCode: string;
  city: string;
  region: Region;
  /** Site coordinates. Optional so a later filing can name a town without a pin. */
  latitude?: number | null;
  longitude?: number | null;
  crashType: CrashType;
  outcome: Outcome;
  severity: Severity;
  fatalities: number;
  injured: number;
  victimName: string | null;
  victimAgeBand: string | null;
  driverStatus: string | null;
  vehicleType: string | null;
  roadwayType: string | null;
  lighting: string | null;
  helmet: string | null;
  policeReportId: string | null;
  summary: string;
  context: string | null;
  sourceName: string;
  sourceUrl: string | null;
  verified: boolean;
  /** Optional pre-resolved fallback when site coordinates are absent. */
  approxLatitude?: number | null;
  approxLongitude?: number | null;
  approxZoom?: number | null;
  locationPrecision?: LocationPrecision | null;
};

export type CrashRow = {
  id: string;
  title: string;
  location_name: string;
  occurred_on: string;
  country: string;
  country_code: string;
  state: string;
  state_code: string;
  city: string;
  region: string;
  latitude: number | null;
  longitude: number | null;
  approx_latitude?: number | null;
  approx_longitude?: number | null;
  approx_zoom?: number | null;
  location_precision?: string | null;
  crash_type: string;
  outcome: string;
  severity: string;
  fatalities: number;
  injured: number;
  victim_name: string | null;
  victim_age_band: string | null;
  driver_status: string | null;
  vehicle_type: string | null;
  roadway_type: string | null;
  lighting: string | null;
  helmet: string | null;
  police_report_id: string | null;
  summary: string;
  context: string | null;
  source_name: string;
  source_url: string | null;
  verified: boolean;
};

export type CrashFilters = {
  q?: string;
  region?: string;
  type?: string;
  outcome?: string;
  severity?: string;
  year?: string;
  state?: string;
};

/** How to read the curated file — public reports, not a national census. */
export const DESK_FRAMING = {
  source: "Curated public reports",
  note: "A small set of publicly reported US bicycle-automotive collisions, with names and news sources when they were published. Not a complete census and not an official traffic-safety total.",
};

function numOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function precisionOrNull(value: unknown): Crash["locationPrecision"] {
  if (value === "exact" || value === "town" || value === "country") return value;
  return null;
}

function outcomeOrDefault(value: unknown): Outcome {
  return value === "serious_injury" ? "serious_injury" : "killed";
}

export function mapCrash(row: CrashRow): Crash {
  return {
    id: row.id,
    title: row.title,
    locationName: row.location_name,
    occurredOn: row.occurred_on,
    country: row.country,
    countryCode: row.country_code,
    state: row.state,
    stateCode: row.state_code,
    city: row.city,
    region: row.region as Region,
    latitude: numOrNull(row.latitude),
    longitude: numOrNull(row.longitude),
    approxLatitude: numOrNull(row.approx_latitude),
    approxLongitude: numOrNull(row.approx_longitude),
    approxZoom: numOrNull(row.approx_zoom),
    locationPrecision: precisionOrNull(row.location_precision),
    crashType: row.crash_type as CrashType,
    outcome: outcomeOrDefault(row.outcome),
    severity: row.severity as Severity,
    fatalities: Number(row.fatalities),
    injured: Number(row.injured),
    victimName: row.victim_name,
    victimAgeBand: row.victim_age_band,
    driverStatus: row.driver_status,
    vehicleType: row.vehicle_type,
    roadwayType: row.roadway_type,
    lighting: row.lighting,
    helmet: row.helmet,
    policeReportId: row.police_report_id,
    summary: row.summary,
    context: row.context,
    sourceName: row.source_name,
    sourceUrl: row.source_url,
    verified: Boolean(row.verified),
  };
}

export function typeLabel(type: string): string {
  return type
    .split("-")
    .map((part) => part.replace(/^\w/, (c) => c.toUpperCase()))
    .join(" ");
}

export function outcomeLabel(outcome: string): string {
  if (outcome === "serious_injury") return "Serious injury";
  if (outcome === "killed") return "Killed";
  return outcome.replace(/^\w/, (c) => c.toUpperCase());
}

export function severityLabel(severity: string): string {
  return severity.replace(/^\w/, (c) => c.toUpperCase());
}

export function driverStatusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  return status
    .split("_")
    .map((part) => part.replace(/^\w/, (c) => c.toUpperCase()))
    .join(" ");
}
