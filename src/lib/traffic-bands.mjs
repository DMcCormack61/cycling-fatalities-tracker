/**
 * Upper-20% bands for traffic volume (AADT) and posted speed.
 *
 * High = at or above the 80th percentile of the segments in view.
 * Red: both high. Orange: exactly one high. Green: both below that line
 * (speed low and volume low). Every segment receives one of the three colors.
 */

export function upperFifthCutoff(values) {
  const sorted = values.filter((n) => Number.isFinite(n)).slice().sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0];
  const index = 0.8 * (sorted.length - 1);
  const lo = Math.floor(index);
  const hi = Math.ceil(index);
  if (lo === hi) return sorted[lo];
  const weight = index - lo;
  return sorted[lo] * (1 - weight) + sorted[hi] * weight;
}

export function trafficBand(aadt, speedMph, volumeCutoff, speedCutoff) {
  const volumeHigh = aadt >= volumeCutoff;
  const speedHigh = speedMph >= speedCutoff;
  if (volumeHigh && speedHigh) return "red";
  if (volumeHigh || speedHigh) return "orange";
  return "green";
}

export function classifySegments(segments) {
  const volumeCutoff = upperFifthCutoff(segments.map((s) => s.aadt));
  const speedCutoff = upperFifthCutoff(segments.map((s) => s.speedMph));
  if (volumeCutoff == null || speedCutoff == null) {
    return { volumeCutoff: null, speedCutoff: null, segments: [] };
  }
  return {
    volumeCutoff,
    speedCutoff,
    segments: segments.map((segment) => ({
      ...segment,
      band: trafficBand(segment.aadt, segment.speedMph, volumeCutoff, speedCutoff),
    })),
  };
}
