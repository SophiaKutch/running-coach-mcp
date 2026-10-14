import type { Run } from "../data/types.js";
import { distanceMiles } from "../data/derived.js";
import type { HeartRateZone, HeartRateZoneResult, HeartRateZoneSummary } from "./types.js";

/**
 * Standard 5-zone model as a percentage of max heart rate. This is a widely
 * used heuristic (not personalized to lactate threshold testing or similar),
 * consistent with this project's disclaimer that it isn't medical or
 * coaching advice.
 */
const ZONE_BOUNDARIES: { zone: HeartRateZone; min: number; max: number }[] = [
  { zone: 1, min: 0.5, max: 0.6 },
  { zone: 2, min: 0.6, max: 0.7 },
  { zone: 3, min: 0.7, max: 0.8 },
  { zone: 4, min: 0.8, max: 0.9 },
  { zone: 5, min: 0.9, max: 1.01 }, // slightly over 1.0 to catch HR right at/above max
];

/**
 * IMPORTANT LIMITATION: a Strava CSV export gives one average-HR number per
 * run, not a continuous HR stream. So this can only classify each *run* into
 * the zone its average effort falls into — it cannot report true
 * "minutes spent in zone 3" the way a device with second-by-second HR data
 * could, because a run's average HR might pass through several zones over
 * its course. We document this clearly rather than present a more precise
 * number than the data actually supports: a tool that answers questions
 * confidently from data it doesn't have is the exact failure mode the evals
 * in Phase 4 are meant to catch.
 */
export function heartRateZones(runs: Run[], maxHeartRate: number): HeartRateZoneResult {
  if (!(maxHeartRate > 0)) {
    throw new Error(`maxHeartRate must be a positive number, got ${maxHeartRate}`);
  }

  const byZone = new Map<HeartRateZone, HeartRateZoneSummary>();
  for (const boundary of ZONE_BOUNDARIES) {
    byZone.set(boundary.zone, {
      zone: boundary.zone,
      rangeLabel: `${Math.round(boundary.min * 100)}-${Math.round(Math.min(boundary.max, 1) * 100)}%`,
      runCount: 0,
      totalMovingTimeSeconds: 0,
      totalMiles: 0,
    });
  }

  let runsWithoutHeartRate = 0;

  for (const run of runs) {
    if (run.averageHeartRate === undefined) {
      runsWithoutHeartRate++;
      continue;
    }
    const zone = classifyZone(run.averageHeartRate, maxHeartRate);
    const summary = byZone.get(zone)!;
    summary.runCount += 1;
    summary.totalMovingTimeSeconds += run.movingTimeSeconds;
    summary.totalMiles += distanceMiles(run);
  }

  return { zones: [...byZone.values()], runsWithoutHeartRate };
}

function classifyZone(averageHeartRate: number, maxHeartRate: number): HeartRateZone {
  const pctOfMax = averageHeartRate / maxHeartRate;
  for (const boundary of ZONE_BOUNDARIES) {
    if (pctOfMax < boundary.max) return boundary.zone;
  }
  return 5;
}
