import type { Run } from "../data/types.js";
import { distanceMiles } from "../data/derived.js";
import { getWeekEnd, groupByWeek } from "./week.js";
import type { LongRunWeek } from "./types.js";

/**
 * The longest single run in each week, in chronological order, alongside a
 * running "longest to date" — this is what answers "am I ready to bump my
 * long run?": you want to see both the current trajectory and whether this
 * week's long run is actually a new high, not just "long for this week".
 */
export function longRunProgression(runs: Run[]): LongRunWeek[] {
  const weeks = groupByWeek(runs);
  const result: LongRunWeek[] = [];
  let cumulativeLongestMiles = 0;

  for (const [weekStart, weekRuns] of weeks) {
    let longestRun = weekRuns[0]!;
    let longestMiles = distanceMiles(longestRun);
    for (const run of weekRuns.slice(1)) {
      const miles = distanceMiles(run);
      if (miles > longestMiles) {
        longestRun = run;
        longestMiles = miles;
      }
    }

    cumulativeLongestMiles = Math.max(cumulativeLongestMiles, longestMiles);

    result.push({
      weekStart,
      weekEnd: getWeekEnd(weekStart),
      longestRun,
      longestRunMiles: longestMiles,
      cumulativeLongestMiles,
    });
  }

  return result;
}
