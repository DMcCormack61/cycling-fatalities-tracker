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
export const LANCASTER_VOLUME_RED = 5000;
export const LANCASTER_MID_VOLUME = 2000;
export const LANCASTER_MID_SHOULDER_FT = 4;
export const LANCASTER_WIDE_SHOULDER_FT = 4;
export const LANCASTER_WIDE_SHOULDER_SPEED_MPH = 45;

export function usesLancasterColors(segment) {
  return typeof segment?.service === "string" && segment.service.startsWith("PennDOT");
}

/** FHWA classes that are limited-access when a road has no PennDOT access-control code. */
const HPMS_LIMITED_ACCESS = new Set(["Interstate", "Freeway or expressway"]);

/**
 * PennDOT ACCESS_CTRL 1 is Limited access (RMSSEG). 2 is partial and 3 is none.
 * HPMS roads have no access-control code, so interstate and freeway classes stand in.
 */
export function isLimitedAccess(segment) {
  const access = segment?.accessControl;
  if (access === "1") return true;
  if (access === "2" || access === "3") return false;
  if (typeof segment?.service === "string" && segment.service.startsWith("PennDOT")) return false;
  return HPMS_LIMITED_ACCESS.has(segment?.functionalClass);
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

/** Shoulder wider than 4 ft and posted speed under 45 mph cannot be red. */
export function lancasterShoulderCapsRed(shoulderFt, speedMph) {
  return (
    Number.isFinite(shoulderFt) &&
    shoulderFt > LANCASTER_WIDE_SHOULDER_FT &&
    Number.isFinite(speedMph) &&
    speedMph < LANCASTER_WIDE_SHOULDER_SPEED_MPH
  );
}

/** Speed over 40, volume between 2,000 and 5,000, and a shoulder under 4 ft. */
export function lancasterMidAmber(aadt, speedMph, shoulderFt) {
  return (
    Number.isFinite(speedMph) &&
    speedMph > LANCASTER_SPEED_AMBER_MPH &&
    aadt > LANCASTER_MID_VOLUME &&
    aadt < LANCASTER_VOLUME_RED &&
    Number.isFinite(shoulderFt) &&
    shoulderFt < LANCASTER_MID_SHOULDER_FT
  );
}

/**
 * PennDOT color for the Lancaster region.
 * Limited access is handled before this and is always red.
 * Volume over 5,000 is red and beats the wide-shoulder cap.
 * A shoulder wider than 4 ft with a posted speed under 45 mph cannot be red.
 * Speed over 40 with volume over 2,000 and under 5,000 and a shoulder under 4 ft is amber.
 * Amber is also the minimum for a shoulder under 2 ft, speed over 40, or volume over 1,000.
 * Volume under 400 is green only when amber and red do not apply.
 * Otherwise red is both volume and speed in the upper 20%.
 */
export function lancasterBand(aadt, speedMph, shoulderFt, volumeCutoff, speedCutoff) {
  if (aadt > LANCASTER_VOLUME_RED) return "red";
  if (lancasterMidAmber(aadt, speedMph, shoulderFt)) return "orange";
  const relative = relativeBand(aadt, speedMph, volumeCutoff, speedCutoff);
  const capped = lancasterShoulderCapsRed(shoulderFt, speedMph);
  if (relative === "red" && !capped) return "red";
  if (lancasterAmberTrigger(aadt, speedMph, shoulderFt)) return "orange";
  if (aadt < LANCASTER_VOLUME_GREEN) return "green";
  if (capped && relative === "red") return "orange";
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
      band: isLimitedAccess(segment)
        ? "red"
        : usesLancasterColors(segment)
          ? lancasterBand(segment.aadt, segment.speedMph, segment.shoulderFt, volumeCutoff, speedCutoff)
          : relativeBand(segment.aadt, segment.speedMph, volumeCutoff, speedCutoff),
    })),
  };
}
