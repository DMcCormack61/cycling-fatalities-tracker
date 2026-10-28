export type TrafficBandName = "red" | "orange" | "green";

export function upperFifthCutoff(values: Array<number | null | undefined>): number | null;

export function trafficBand(
  aadt: number,
  speedMph: number | null,
  volumeCutoff: number,
  speedCutoff: number,
): TrafficBandName;

export function classifySegments<T extends { aadt: number; speedMph: number | null }>(
  segments: T[],
): {
  volumeCutoff: number | null;
  speedCutoff: number | null;
  segments: Array<T & { band: TrafficBandName }>;
};
