import { PENNDOT_REGION_BOUNDS, PENNDOT_REGION_LABEL } from "@/lib/penndot-region.mjs";

/** Cities used as jump targets. Centers match the bundled HPMS sample boxes. */

export type TrafficPlace = {
  label: string;
  lat: number;
  lng: number;
  zoom: number;
  /** [west, south, east, north]. The chip fits this frame instead of a city zoom. */
  bounds?: [number, number, number, number];
};

export const UNITED_STATES_VIEW: TrafficPlace = {
  label: "United States",
  lat: 39.5,
  lng: -98.35,
  zoom: 4,
};

export const TRAFFIC_CITIES: TrafficPlace[] = [
  { label: "Chicago", lat: 41.88479, lng: -87.63244, zoom: 15 },
  { label: "Philadelphia", lat: 39.97218, lng: -75.1936, zoom: 15 },
  {
    label: PENNDOT_REGION_LABEL,
    lat: 40.19,
    lng: -76.24,
    zoom: 9,
    // Union of PennDOT extents for Lancaster and the PA counties that border it.
    bounds: [...PENNDOT_REGION_BOUNDS] as [number, number, number, number],
  },
  { label: "Cambridge", lat: 42.36202, lng: -71.07956, zoom: 15 },
  { label: "Fort Worth", lat: 32.74988, lng: -97.31191, zoom: 15 },
  { label: "Sacramento", lat: 38.59623, lng: -121.47624, zoom: 15 },
  { label: "San Carlos", lat: 37.51, lng: -122.26, zoom: 15 },
  { label: "Albuquerque", lat: 35.08129, lng: -106.64974, zoom: 15 },
  { label: "Denver", lat: 39.75756, lng: -104.9849, zoom: 15 },
  { label: "Minneapolis", lat: 44.95531, lng: -93.27038, zoom: 15 },
  { label: "Miami", lat: 25.77897, lng: -80.19423, zoom: 15 },
  { label: "Spokane", lat: 47.66188, lng: -117.39462, zoom: 15 },
  { label: "Oldmans Township", lat: 39.71697, lng: -75.45483, zoom: 15 },
];

export const TRAFFIC_COLORS = {
  red: "#b42318",
  orange: "#d97706",
  green: "#1d7a46",
} as const;

/** City zoom and closer. Wider frames stay on the bundled corridors. */
export const TRAFFIC_LIVE_MIN_ZOOM = 11;

export const TRAFFIC_BAND_LABEL = {
  red: "High / high",
  orange: "One high",
  green: "Both low",
} as const;
