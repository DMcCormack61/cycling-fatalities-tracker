/** State layers on the public FHWA HPMS FeatureServer (geo.dot.gov). */

export type HpmsState = {
  abbr: string;
  name: string;
  fips: number;
  /** [west, south, east, north] */
  bbox: [number, number, number, number];
  services: string[];
};

function services(abbr: string, extra: string[] = []): string[] {
  return [
    ...extra,
    `HPMS_FULL_${abbr}_2023`,
    `HPMS_FULL_${abbr}_2024`,
    `HPMS_FULL_${abbr}_2022`,
    `HPMS_FULL_${abbr}_2025`,
  ];
}

export const HPMS_STATES: HpmsState[] = [
  { abbr: "AL", name: "Alabama", fips: 1, bbox: [-88.47, 30.22, -84.89, 35.01], services: services("AL") },
  { abbr: "AK", name: "Alaska", fips: 2, bbox: [-179.15, 51.21, -129.98, 71.39], services: services("AK") },
  { abbr: "AZ", name: "Arizona", fips: 4, bbox: [-114.82, 31.33, -109.04, 37.0], services: services("AZ") },
  { abbr: "AR", name: "Arkansas", fips: 5, bbox: [-94.62, 33.0, -89.64, 36.5], services: services("AR") },
  { abbr: "CA", name: "California", fips: 6, bbox: [-124.41, 32.53, -114.13, 42.01], services: services("CA") },
  { abbr: "CO", name: "Colorado", fips: 8, bbox: [-109.06, 36.99, -102.04, 41.0], services: services("CO") },
  { abbr: "CT", name: "Connecticut", fips: 9, bbox: [-73.73, 40.98, -71.79, 42.05], services: services("CT") },
  { abbr: "DE", name: "Delaware", fips: 10, bbox: [-75.79, 38.45, -75.05, 39.84], services: services("DE") },
  { abbr: "DC", name: "District of Columbia", fips: 11, bbox: [-77.12, 38.79, -76.91, 38.99], services: services("DC") },
  { abbr: "FL", name: "Florida", fips: 12, bbox: [-87.63, 24.52, -80.03, 31.0], services: services("FL") },
  { abbr: "GA", name: "Georgia", fips: 13, bbox: [-85.61, 30.36, -80.84, 35.0], services: services("GA", ["HPMS_FULL_GA3_2023"]) },
  { abbr: "HI", name: "Hawaii", fips: 15, bbox: [-160.25, 18.91, -154.81, 22.24], services: services("HI") },
  { abbr: "ID", name: "Idaho", fips: 16, bbox: [-117.24, 41.99, -111.04, 49.0], services: services("ID") },
  { abbr: "IL", name: "Illinois", fips: 17, bbox: [-91.51, 36.97, -87.49, 42.51], services: services("IL") },
  { abbr: "IN", name: "Indiana", fips: 18, bbox: [-88.1, 37.77, -84.78, 41.76], services: services("IN") },
  { abbr: "IA", name: "Iowa", fips: 19, bbox: [-96.64, 40.38, -90.14, 43.5], services: services("IA") },
  { abbr: "KS", name: "Kansas", fips: 20, bbox: [-102.05, 36.99, -94.59, 40.0], services: services("KS") },
  { abbr: "KY", name: "Kentucky", fips: 21, bbox: [-89.57, 36.5, -81.96, 39.15], services: services("KY") },
  { abbr: "LA", name: "Louisiana", fips: 22, bbox: [-94.04, 28.93, -88.82, 33.02], services: services("LA") },
  { abbr: "ME", name: "Maine", fips: 23, bbox: [-71.08, 43.06, -66.95, 47.46], services: services("ME") },
  { abbr: "MD", name: "Maryland", fips: 24, bbox: [-79.49, 37.91, -75.05, 39.72], services: services("MD") },
  { abbr: "MA", name: "Massachusetts", fips: 25, bbox: [-73.51, 41.24, -69.93, 42.89], services: services("MA") },
  { abbr: "MI", name: "Michigan", fips: 26, bbox: [-90.42, 41.7, -82.41, 48.19], services: services("MI") },
  { abbr: "MN", name: "Minnesota", fips: 27, bbox: [-97.24, 43.5, -89.49, 49.38], services: services("MN") },
  { abbr: "MS", name: "Mississippi", fips: 28, bbox: [-91.66, 30.17, -88.1, 35.0], services: services("MS") },
  { abbr: "MO", name: "Missouri", fips: 29, bbox: [-95.77, 35.99, -89.1, 40.61], services: services("MO") },
  { abbr: "MT", name: "Montana", fips: 30, bbox: [-116.05, 44.36, -104.04, 49.0], services: services("MT") },
  { abbr: "NE", name: "Nebraska", fips: 31, bbox: [-104.05, 40.0, -95.31, 43.0], services: services("NE") },
  { abbr: "NV", name: "Nevada", fips: 32, bbox: [-120.01, 35.0, -114.04, 42.0], services: services("NV") },
  { abbr: "NH", name: "New Hampshire", fips: 33, bbox: [-72.56, 42.7, -70.7, 45.31], services: services("NH") },
  { abbr: "NJ", name: "New Jersey", fips: 34, bbox: [-75.56, 38.93, -73.89, 41.36], services: services("NJ") },
  { abbr: "NM", name: "New Mexico", fips: 35, bbox: [-109.05, 31.33, -103.0, 37.0], services: services("NM") },
  { abbr: "NY", name: "New York", fips: 36, bbox: [-79.76, 40.5, -71.86, 45.02], services: services("NY") },
  { abbr: "NC", name: "North Carolina", fips: 37, bbox: [-84.32, 33.84, -75.46, 36.59], services: services("NC") },
  { abbr: "ND", name: "North Dakota", fips: 38, bbox: [-104.05, 45.94, -96.55, 49.0], services: services("ND") },
  { abbr: "OH", name: "Ohio", fips: 39, bbox: [-84.82, 38.4, -80.52, 42.0], services: services("OH") },
  { abbr: "OK", name: "Oklahoma", fips: 40, bbox: [-103.0, 33.62, -94.43, 37.0], services: services("OK") },
  { abbr: "OR", name: "Oregon", fips: 41, bbox: [-124.57, 41.99, -116.46, 46.29], services: services("OR") },
  { abbr: "PA", name: "Pennsylvania", fips: 42, bbox: [-80.52, 39.72, -74.69, 42.27], services: services("PA") },
  { abbr: "RI", name: "Rhode Island", fips: 44, bbox: [-71.86, 41.15, -71.12, 42.02], services: services("RI") },
  { abbr: "SC", name: "South Carolina", fips: 45, bbox: [-83.35, 32.05, -78.54, 35.22], services: services("SC") },
  { abbr: "SD", name: "South Dakota", fips: 46, bbox: [-104.06, 42.48, -96.44, 45.95], services: services("SD") },
  { abbr: "TN", name: "Tennessee", fips: 47, bbox: [-90.31, 34.98, -81.65, 36.68], services: services("TN") },
  { abbr: "TX", name: "Texas", fips: 48, bbox: [-106.65, 25.84, -93.51, 36.5], services: services("TX") },
  { abbr: "UT", name: "Utah", fips: 49, bbox: [-114.05, 37.0, -109.04, 42.0], services: services("UT") },
  { abbr: "VT", name: "Vermont", fips: 50, bbox: [-73.44, 42.73, -71.46, 45.02], services: services("VT") },
  { abbr: "VA", name: "Virginia", fips: 51, bbox: [-83.68, 36.54, -75.24, 39.47], services: services("VA") },
  { abbr: "WA", name: "Washington", fips: 53, bbox: [-124.73, 45.54, -116.92, 49.0], services: services("WA") },
  { abbr: "WV", name: "West Virginia", fips: 54, bbox: [-82.64, 37.2, -77.72, 40.64], services: services("WV") },
  { abbr: "WI", name: "Wisconsin", fips: 55, bbox: [-92.89, 42.49, -86.25, 47.08], services: services("WI") },
  { abbr: "WY", name: "Wyoming", fips: 56, bbox: [-111.06, 40.99, -104.05, 45.01], services: services("WY") },
];

/** Smallest state box containing the point, so DC wins over Maryland. */
export function hpmsStateAt(lat: number, lng: number): HpmsState | null {
  let best: HpmsState | null = null;
  let bestArea = Infinity;
  for (const state of HPMS_STATES) {
    const [west, south, east, north] = state.bbox;
    if (lng < west || lng > east || lat < south || lat > north) continue;
    const area = (east - west) * (north - south);
    if (area < bestArea) {
      best = state;
      bestArea = area;
    }
  }
  return best;
}
