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
  const speedKnown = Number.isFinite(speedMph);
  if (!speedKnown) return volumeHigh ? "orange" : "green";
  const speedHigh = speedMph >= speedCutoff;
  if (volumeHigh && speedHigh) return "red";
  if (volumeHigh || speedHigh) return "orange";
  return "green";
}

/** PennDOT Lancaster layer. Comparisons are strict, matching the legend. */
export const LANCASTER_SHOULDER_AMBER_FT = 2;
export const LANCASTER_SPEED_AMBER_MPH = 40;
export const LANCASTER_VOLUME_AMBER = 1000;
export const LANCASTER_VOLUME_GREEN = 400;

export function usesLancasterColors(segment) {
  return typeof segment?.service === "string" && segment.service.startsWith("PennDOT");
}

export function lancasterAmberTrigger(aadt, speedMph, shoulderFt) {
  const narrowShoulder = Number.isFinite(shoulderFt) && shoulderFt < LANCASTER_SHOULDER_AMBER_FT;
  const fast = Number.isFinite(speedMph) && speedMph > LANCASTER_SPEED_AMBER_MPH;
  const busy = aadt > LANCASTER_VOLUME_AMBER;
  return narrowShoulder || fast || busy;
}

function relativeBand(aadt, speedMph, volumeCutoff, speedCutoff) {
  if (speedCutoff == null) return aadt >= volumeCutoff ? "orange" : "green";
  return trafficBand(aadt, speedMph, volumeCutoff, speedCutoff);
}

/**
 * Lancaster PennDOT color. Red is still both volume and speed in the upper 20%.
 * Otherwise amber wins when the shoulder is under 2 ft, posted speed is over 40,
 * or volume is over 1,000. Volume under 400 is green only when amber and red do not apply.
 * Priority is red, then amber, then green.
 */
export function lancasterBand(aadt, speedMph, shoulderFt, volumeCutoff, speedCutoff) {
  const relative = relativeBand(aadt, speedMph, volumeCutoff, speedCutoff);
  if (relative === "red") return "red";
  if (lancasterAmberTrigger(aadt, speedMph, shoulderFt)) return "orange";
  if (aadt < LANCASTER_VOLUME_GREEN) return "green";
  return relative;
}

export function classifySegments(segments) {
  const volumeCutoff = upperFifthCutoff(segments.map((s) => s.aadt));
  const speedCutoff = upperFifthCutoff(segments.map((s) => s.speedMph));
  if (volumeCutoff == null) {
    return { volumeCutoff: null, speedCutoff: null, segments: [] };
  }
  return {
    volumeCutoff,
    speedCutoff,
    segments: segments.map((segment) => ({
      ...segment,
      band: usesLancasterColors(segment)
        ? lancasterBand(segment.aadt, segment.speedMph, segment.shoulderFt, volumeCutoff, speedCutoff)
        : relativeBand(segment.aadt, segment.speedMph, volumeCutoff, speedCutoff),
    })),
  };
}
