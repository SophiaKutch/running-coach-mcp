import type { Run } from "../data/types.js";
import { distanceMiles } from "../data/derived.js";
import { getWeekEnd, groupByWeek } from "./week.js";
import type { PaceTrendResult, WeeklyPace } from "./types.js";

/**
 * Below this slope magnitude (seconds/mile per week) we call the trend
 * "stable" rather than reading noise as improvement or decline. Five
 * seconds/mile/week compounds to a lot over a season, but week-to-week
 * pace naturally wobbles by more than that from weather, terrain, and
 * which specific workouts landed in a given week.
 */
const STABLE_SLOPE_THRESHOLD_SEC_PER_MILE_PER_WEEK = 1.5;
/** Need at least this many weeks of data for a regression slope to mean anything. */
const MIN_WEEKS_FOR_TREND = 3;

/**
 * Weekly pace (time-weighted: total moving time / total distance, not an
 * average of each run's pace — a week with one long slow run and one short
 * fast one shouldn't have those two paces weighted equally) plus a trend
 * classification fit by ordinary least-squares regression over the weekly
 * averages.
 *
 * This only looks at pace, not effort — a faster pace at a much higher
 * heart rate isn't necessarily "improvement". Pairing this with
 * `heartRateZones` output is left to the caller (or the model, with both
 * tool results in hand).
 */
export function paceTrends(runs: Run[]): PaceTrendResult {
  const weeksMap = groupByWeek(runs);
  const weeks: WeeklyPace[] = [];

  for (const [weekStart, weekRuns] of weeksMap) {
    let totalMiles = 0;
    let totalSeconds = 0;
    for (const run of weekRuns) {
      totalMiles += distanceMiles(run);
      totalSeconds += run.movingTimeSeconds;
    }
    weeks.push({
      weekStart,
      weekEnd: getWeekEnd(weekStart),
      averagePaceSecondsPerMile: totalMiles > 0 ? totalSeconds / totalMiles : undefined,
      runCount: weekRuns.length,
    });
  }

  const points = weeks
    .map((w, index) => ({ x: index, y: w.averagePaceSecondsPerMile }))
    .filter((p): p is { x: number; y: number } => p.y !== undefined);

  if (points.length < MIN_WEEKS_FOR_TREND) {
    return { weeks, trend: "insufficient-data", slopeSecondsPerMilePerWeek: undefined };
  }

  const slope = leastSquaresSlope(points);
  const trend =
    slope > STABLE_SLOPE_THRESHOLD_SEC_PER_MILE_PER_WEEK
      ? "declining" // pace (sec/mile) going up over time = getting slower
      : slope < -STABLE_SLOPE_THRESHOLD_SEC_PER_MILE_PER_WEEK
        ? "improving"
        : "stable";

  return { weeks, trend, slopeSecondsPerMilePerWeek: slope };
}

function leastSquaresSlope(points: { x: number; y: number }[]): number {
  const n = points.length;
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumXX = points.reduce((s, p) => s + p.x * p.x, 0);
  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return 0;
  return (n * sumXY - sumX * sumY) / denominator;
}
