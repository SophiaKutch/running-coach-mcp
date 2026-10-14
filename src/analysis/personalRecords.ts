import type { Run } from "../data/types.js";
import { paceSecondsPerMile } from "../data/derived.js";
import { weeklyMileage } from "./weeklyMileage.js";
import type { BestEffort, PersonalRecords, StandardDistance } from "./types.js";

/**
 * Standard race distances in meters, with a tolerance band for matching a
 * GPS-tracked training run to one of them. Real runs are never exactly
 * 5000.0m — GPS drift and tangents mean a "5K" is commonly logged anywhere
 * from about 4.9 to 5.1 actual kilometers — so we match on a window rather
 * than exact equality.
 */
const STANDARD_DISTANCES: { label: StandardDistance; meters: number; toleranceFraction: number }[] = [
  { label: "5K", meters: 5000, toleranceFraction: 0.07 },
  { label: "10K", meters: 10000, toleranceFraction: 0.07 },
  { label: "Half Marathon", meters: 21097.5, toleranceFraction: 0.05 },
  { label: "Marathon", meters: 42195, toleranceFraction: 0.05 },
];

/** Ignore anything shorter than this when ranking "fastest overall pace" — a block of 400m repeats isn't a representative pace. */
const MIN_METERS_FOR_OVERALL_PACE = 1609.344;

export function personalRecords(runs: Run[]): PersonalRecords {
  if (runs.length === 0) {
    return { bestEffortsByDistance: {} };
  }

  let longestRun = runs[0]!;
  for (const run of runs) {
    if (run.distanceMeters > longestRun.distanceMeters) longestRun = run;
  }

  let fastestOverallPace: PersonalRecords["fastestOverallPace"];
  for (const run of runs) {
    if (run.distanceMeters < MIN_METERS_FOR_OVERALL_PACE) continue;
    const pace = paceSecondsPerMile(run);
    if (pace === undefined) continue;
    if (fastestOverallPace === undefined || pace < fastestOverallPace.paceSecondsPerMile) {
      fastestOverallPace = { run, paceSecondsPerMile: pace };
    }
  }

  const bestEffortsByDistance: Partial<Record<StandardDistance, BestEffort>> = {};
  for (const standard of STANDARD_DISTANCES) {
    const lowerBound = standard.meters * (1 - standard.toleranceFraction);
    const upperBound = standard.meters * (1 + standard.toleranceFraction);
    let best: BestEffort | undefined;
    for (const run of runs) {
      if (run.distanceMeters < lowerBound || run.distanceMeters > upperBound) continue;
      if (best === undefined || run.movingTimeSeconds < best.timeSeconds) {
        best = { run, timeSeconds: run.movingTimeSeconds };
      }
    }
    if (best) bestEffortsByDistance[standard.label] = best;
  }

  const weeks = weeklyMileage(runs);
  let highestMileageWeek: PersonalRecords["highestMileageWeek"];
  for (const week of weeks) {
    if (highestMileageWeek === undefined || week.totalMiles > highestMileageWeek.totalMiles) {
      highestMileageWeek = { weekStart: week.weekStart, weekEnd: week.weekEnd, totalMiles: week.totalMiles };
    }
  }

  return { longestRun, fastestOverallPace, bestEffortsByDistance, highestMileageWeek };
}
