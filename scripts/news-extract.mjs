/**
 * Turn a news headline into a crash candidate.
 * Only explicit dates, places, outcomes, and names are kept.
 * Anything missing stays null; the caller skips a story with no US place or outcome.
 */
import { createHash } from "node:crypto";

const STATES = [
  ["Alabama", "AL"],
  ["Alaska", "AK"],
  ["Arizona", "AZ"],
  ["Arkansas", "AR"],
  ["California", "CA"],
  ["Colorado", "CO"],
  ["Connecticut", "CT"],
  ["Delaware", "DE"],
  ["District of Columbia", "DC"],
  ["Florida", "FL"],
  ["Georgia", "GA"],
  ["Hawaii", "HI"],
  ["Idaho", "ID"],
  ["Illinois", "IL"],
  ["Indiana", "IN"],
  ["Iowa", "IA"],
  ["Kansas", "KS"],
  ["Kentucky", "KY"],
  ["Louisiana", "LA"],
  ["Maine", "ME"],
  ["Maryland", "MD"],
  ["Massachusetts", "MA"],
  ["Michigan", "MI"],
  ["Minnesota", "MN"],
  ["Mississippi", "MS"],
  ["Missouri", "MO"],
  ["Montana", "MT"],
  ["Nebraska", "NE"],
  ["Nevada", "NV"],
  ["New Hampshire", "NH"],
  ["New Jersey", "NJ"],
  ["New Mexico", "NM"],
  ["New York", "NY"],
  ["North Carolina", "NC"],
  ["North Dakota", "ND"],
  ["Ohio", "OH"],
  ["Oklahoma", "OK"],
  ["Oregon", "OR"],
  ["Pennsylvania", "PA"],
  ["Rhode Island", "RI"],
  ["South Carolina", "SC"],
  ["South Dakota", "SD"],
  ["Tennessee", "TN"],
  ["Texas", "TX"],
  ["Utah", "UT"],
  ["Vermont", "VT"],
  ["Virginia", "VA"],
  ["Washington", "WA"],
  ["West Virginia", "WV"],
  ["Wisconsin", "WI"],
  ["Wyoming", "WY"],
];

const REGIONS = {
  CT: "Northeast",
  ME: "Northeast",
  MA: "Northeast",
  NH: "Northeast",
  RI: "Northeast",
  VT: "Northeast",
  NJ: "Northeast",
  NY: "Northeast",
  PA: "Northeast",
  IL: "Midwest",
  IN: "Midwest",
  MI: "Midwest",
  OH: "Midwest",
  WI: "Midwest",
  IA: "Midwest",
  KS: "Midwest",
  MN: "Midwest",
  MO: "Midwest",
  NE: "Midwest",
  ND: "Midwest",
  SD: "Midwest",
  DE: "South",
  FL: "South",
  GA: "South",
  MD: "South",
  NC: "South",
  SC: "South",
  VA: "South",
  WV: "South",
  AL: "South",
  KY: "South",
  MS: "South",
  TN: "South",
  AR: "South",
  LA: "South",
  OK: "South",
  TX: "South",
  DC: "South",
  AZ: "West",
  CO: "West",
  ID: "West",
  MT: "West",
  NV: "West",
  NM: "West",
  UT: "West",
  WY: "West",
  AK: "West",
  CA: "West",
  HI: "West",
  OR: "West",
  WA: "West",
};

const ABBREV = {
  ala: "Alabama",
  ariz: "Arizona",
  ark: "Arkansas",
  calif: "California",
  colo: "Colorado",
  conn: "Connecticut",
  del: "Delaware",
  fla: "Florida",
  ill: "Illinois",
  ind: "Indiana",
  kans: "Kansas",
  mass: "Massachusetts",
  mich: "Michigan",
  minn: "Minnesota",
  miss: "Mississippi",
  pa: "Pennsylvania",
  tenn: "Tennessee",
  tex: "Texas",
  wash: "Washington",
  wis: "Wisconsin",
  wva: "West Virginia",
};

const NAME_STOP = new Set(
  `police sheriff cyclist bicyclist driver man woman person pedestrian officials authorities
  troopers deputies department avenue street road county city state north south east west
  monday tuesday wednesday thursday friday saturday sunday january february march april
  june july august september october november december victim crash bicycle bike car truck
  suv van hit killed injured died dead fatal seriously critical condition report says said
  after before while near`.split(/\s+/),
);

const MONTHS = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  sept: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

function findState(title) {
  const hits = [];
  const names = [...STATES].sort((a, b) => b[0].length - a[0].length);
  for (const [name, code] of names) {
    const re = new RegExp(`,\\s*(${name.replace(/\s+/g, "\\s+")})\\b`, "gi");
    for (const match of title.matchAll(re)) {
      const index = match.index + match[0].search(new RegExp(name.replace(/\s+/g, "\\s+"), "i"));
      const length = match[0].length - (index - match.index);
      if (streetSuffix(title, index + length)) continue;
      hits.push({ index, length, state: name, stateCode: code });
    }
  }
  // Postal abbreviations only after a comma, so "Police ID" is not Idaho.
  for (const [, code] of STATES) {
    const re = new RegExp(`,\\s*(${code})(?![A-Za-z])`, "g");
    for (const match of title.matchAll(re)) {
      const index = match.index + match[0].indexOf(code);
      hits.push({ index, length: code.length, state: STATES.find((item) => item[1] === code)[0], stateCode: code });
    }
  }
  for (const [abbr, name] of Object.entries(ABBREV)) {
    const re = new RegExp(`(?<![A-Za-z])${abbr}\\.(?![A-Za-z])`, "gi");
    const state = STATES.find(([label]) => label === name);
    if (!state) continue;
    for (const match of title.matchAll(re)) {
      if (streetSuffix(title, match.index + match[0].length)) continue;
      hits.push({ index: match.index, length: match[0].length, state: state[0], stateCode: state[1] });
    }
  }
  if (hits.length === 0) return null;
  hits.sort((a, b) => b.length - a.length || a.index - b.index);
  const kept = [];
  for (const hit of hits) {
    const inside = kept.some(
      (other) =>
        hit.index >= other.index && hit.index + hit.length <= other.index + other.length,
    );
    if (!inside) kept.push(hit);
  }
  kept.sort((a, b) => a.index - b.index);
  return kept[kept.length - 1];
}

function streetSuffix(title, index) {
  const rest = title.slice(index).replace(/^[\s.,]+/, "");
  return /^(st|street|ave|avenue|rd|road|blvd|boulevard|dr|drive|ln|lane|way|pike|hwy|highway|ct|court|pl|place)\b/i.test(
    rest,
  );
}

function cleanTitle(title) {
  return String(title || "")
    .replace(/\s+/g, " ")
    .replace(/\s+-\s+[^-]+$/, "")
    .trim();
}

function outcomeOf(title) {
  const killed = /\b(killed|dies|died|dead|fatally|fatal)\b/i.test(title);
  const injured = /\b(injured|injuries|hurt|hospitalized|critical condition|serious condition)\b/i.test(title);
  if (killed) return "killed";
  if (injured) return "serious_injury";
  return null;
}

function placeOf(title) {
  const state = findState(title);
  if (!state) return null;
  const before = title.slice(0, state.index).replace(/[,\s]+$/, "");
  const cityMatch = before.match(
    /([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,3})\s*(?:County|Parish)?$/,
  );
  if (!cityMatch) return null;
  let city = cityMatch[1].trim().replace(/^City of\s+/i, "");
  const words = city.split(/\s+/).filter(Boolean);
  const collapsed = [];
  for (const word of words) {
    if (collapsed.length && collapsed[collapsed.length - 1].toLowerCase() === word.toLowerCase()) continue;
    collapsed.push(word);
  }
  city = collapsed.join(" ");
  if (/^(A|An|The|In|On|At|Near|After|While)$/.test(city)) return null;
  if (
    city
      .split(/[^A-Za-z]+/)
      .some((word) =>
        ["police", "sheriff", "update", "identified", "officials", "driver", "cyclist", "bicyclist", "says", "said"].includes(
          word.toLowerCase(),
        ),
      )
  ) {
    return null;
  }
  const countyWord = /\b(County|Parish)\b/i.test(before.slice(cityMatch.index));
  if (countyWord && !/county|parish/i.test(city)) city = `${city} County`;
  if (city.toLowerCase() === state.state.toLowerCase()) return null;
  return { city, state: state.state, stateCode: state.stateCode };
}

function nameOf(title) {
  const patterns = [
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})(?:,\s*\d{1,3})?,?\s+(?:was\s+|is\s+)?(?:killed|died|fatally)/,
    /\bdeath of ([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\b/,
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}),\s*\d{1,3},\s+(?:was\s+)?(?:killed|died)\b/,
    /\b(?:identified|ID'd|Id'd)\s+as\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\b/,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(title);
    if (!match) continue;
    const name = match[1].trim();
    const words = name.split(/\s+/);
    if (words.some((word) => NAME_STOP.has(word.toLowerCase()))) continue;
    if (words.length < 2) continue;
    return name;
  }
  return null;
}

function dateOf(title, publishedOn) {
  const yearFallback = Number(String(publishedOn).slice(0, 4));
  const monthName = Object.keys(MONTHS)
    .sort((a, b) => b.length - a.length)
    .join("|");
  const patterns = [
    new RegExp(`\\b(${monthName})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(20\\d{2})\\b`, "i"),
    new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthName})\\.?\\s+(20\\d{2})\\b`, "i"),
    new RegExp(`\\b(${monthName})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, "i"),
  ];
  const first = patterns[0].exec(title);
  if (first) {
    const month = MONTHS[first[1].toLowerCase()];
    const day = Number(first[2]);
    const year = Number(first[3]);
    if (month && day >= 1 && day <= 31) {
      return { occurredOn: iso(year, month, day), datePrecision: "day" };
    }
  }
  const second = patterns[1].exec(title);
  if (second) {
    const day = Number(second[1]);
    const month = MONTHS[second[2].toLowerCase()];
    const year = Number(second[3]);
    if (month && day >= 1 && day <= 31) {
      return { occurredOn: iso(year, month, day), datePrecision: "day" };
    }
  }
  const third = patterns[2].exec(title);
  if (third && Number.isFinite(yearFallback)) {
    const month = MONTHS[third[1].toLowerCase()];
    const day = Number(third[2]);
    if (month && day >= 1 && day <= 31) {
      return { occurredOn: iso(yearFallback, month, day), datePrecision: "day" };
    }
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(publishedOn || ""))) {
    return { occurredOn: publishedOn, datePrecision: "published" };
  }
  return null;
}

function iso(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * @returns {object | null} a candidate, or null when place or outcome was not in the title
 */
export function extractCandidate({ title, url, publishedOn, sourceName }) {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  const raw = String(title || "").replace(/\s+/g, " ").trim();
  const parts = raw.match(/^(.*)\s+-\s+([^-]+)$/);
  const headline = cleanTitle(parts ? parts[1] : raw);
  const outlet = parts ? parts[2].trim() : "";
  if (!headline) return null;
  const outcome = outcomeOf(headline);
  const when = dateOf(headline, publishedOn);
  let place = placeOf(headline);
  if (!place && /city of|county|\.gov/i.test(outlet)) place = placeOf(outlet);
  if (!outcome || !place || !when) return null;
  const victimName = nameOf(headline);
  const killed = outcome === "killed";
  return {
    title: headline.slice(0, 180),
    locationName: `${place.city}, ${place.state}`,
    occurredOn: when.occurredOn,
    datePrecision: when.datePrecision,
    country: "United States",
    countryCode: "USA",
    state: place.state,
    stateCode: place.stateCode,
    city: place.city,
    region: REGIONS[place.stateCode],
    latitude: null,
    longitude: null,
    locationPrecision: null,
    crashType: "other",
    outcome,
    severity: killed ? "critical" : "high",
    fatalities: killed ? 1 : 0,
    injured: killed ? 0 : 1,
    victimName,
    victimAgeBand: null,
    driverStatus: "unknown",
    vehicleType: null,
    roadwayType: null,
    lighting: null,
    helmet: "unknown",
    policeReportId: null,
    summary: headline,
    context:
      when.datePrecision === "published"
        ? "Unreviewed news candidate. The headline did not state a crash date; the stored date is the article publication date. Not in desk totals until promoted."
        : "Unreviewed news candidate extracted from the headline only. Not in desk totals until promoted.",
    sourceName: sourceName || "News",
    sourceUrl: url,
    verified: false,
    ingestSource: "news",
    reviewStatus: "pending",
  };
}

export function articleId(url) {
  const digest = createHash("sha1").update(String(url)).digest("hex").slice(0, 16);
  return `news-${digest}`;
}
