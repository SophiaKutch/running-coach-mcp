import type { Run } from "../data/types.js";
import { distanceMiles, distanceKm } from "../data/derived.js";
import { getWeekEnd, groupByWeek } from "./week.js";
import type { WeeklyMileage } from "./types.js";

/**
 * Total distance, time, and run count per Monday-start week, in chronological
 * order. This is the building block most of the other weekly-rollup
 * functions (long-run progression, training load) are built on top of.
 */
export function weeklyMileage(runs: Run[]): WeeklyMileage[] {
  const weeks = groupByWeek(runs);
  const result: WeeklyMileage[] = [];

  for (const [weekStart, weekRuns] of weeks) {
    let totalMiles = 0;
    let totalKm = 0;
    let totalMovingTimeSeconds = 0;
    for (const run of weekRuns) {
      totalMiles += distanceMiles(run);
      totalKm += distanceKm(run);
      totalMovingTimeSeconds += run.movingTimeSeconds;
    }
    result.push({
      weekStart,
      weekEnd: getWeekEnd(weekStart),
      totalMiles,
      totalKm,
      runCount: weekRuns.length,
      totalMovingTimeSeconds,
    });
  }

  return result;
}
