export type TrafficBandName = "red" | "orange" | "green";

export function upperFifthCutoff(values: Array<number | null | undefined>): number | null;

export function trafficBand(
  aadt: number,
  speedMph: number | null,
  volumeCutoff: number,
  speedCutoff: number,
): TrafficBandName;

export const LANCASTER_SHOULDER_AMBER_FT: number;
export const LANCASTER_SPEED_AMBER_MPH: number;
export const LANCASTER_VOLUME_AMBER: number;
export const LANCASTER_VOLUME_GREEN: number;

export function usesLancasterColors(segment: { service?: string } | null | undefined): boolean;

export function lancasterAmberTrigger(
  aadt: number,
  speedMph: number | null,
  shoulderFt: number | null | undefined,
): boolean;

export function lancasterBand(
  aadt: number,
  speedMph: number | null,
  shoulderFt: number | null | undefined,
  volumeCutoff: number,
  speedCutoff: number | null,
): TrafficBandName;

export function classifySegments<T extends { aadt: number; speedMph: number | null }>(
  segments: T[],
): {
  volumeCutoff: number | null;
  speedCutoff: number | null;
  segments: Array<T & { band: TrafficBandName }>;
};
