import type { Run } from "../data/types.js";
import { distanceMiles } from "../data/derived.js";

export interface PeriodRange {
  /** Inclusive, "yyyy-mm-dd". */
  start: string;
  /** Inclusive, "yyyy-mm-dd". */
  end: string;
}

export interface PeriodStats extends PeriodRange {
  runCount: number;
  totalMiles: number;
  totalMovingTimeSeconds: number;
  averagePaceSecondsPerMile: number | undefined;
}

export interface PeriodComparison {
  periodA: PeriodStats;
  periodB: PeriodStats;
  deltas: {
    totalMilesDelta: number;
    runCountDelta: number;
    /** periodA pace minus periodB pace, in seconds/mile. Negative means period A was faster. */
    averagePaceSecondsPerMileDelta: number | undefined;
  };
}

/**
 * Compares training volume and pace between two arbitrary date ranges.
 * Ranges may overlap (the caller's responsibility to pick sensible ones) --
 * this function just computes stats for each independently and the delta
 * between them.
 */
export function comparePeriods(runs: Run[], periodA: PeriodRange, periodB: PeriodRange): PeriodComparison {
  const statsA = statsForRange(runs, periodA);
  const statsB = statsForRange(runs, periodB);

  return {
    periodA: statsA,
    periodB: statsB,
    deltas: {
      totalMilesDelta: statsA.totalMiles - statsB.totalMiles,
      runCountDelta: statsA.runCount - statsB.runCount,
      averagePaceSecondsPerMileDelta:
        statsA.averagePaceSecondsPerMile !== undefined && statsB.averagePaceSecondsPerMile !== undefined
          ? statsA.averagePaceSecondsPerMile - statsB.averagePaceSecondsPerMile
          : undefined,
    },
  };
}

function statsForRange(runs: Run[], range: PeriodRange): PeriodStats {
  let runCount = 0;
  let totalMiles = 0;
  let totalMovingTimeSeconds = 0;

  for (const run of runs) {
    if (run.date < range.start || run.date > range.end) continue;
    runCount += 1;
    totalMiles += distanceMiles(run);
    totalMovingTimeSeconds += run.movingTimeSeconds;
  }

  return {
    start: range.start,
    end: range.end,
    runCount,
    totalMiles,
    totalMovingTimeSeconds,
    averagePaceSecondsPerMile: totalMiles > 0 ? totalMovingTimeSeconds / totalMiles : undefined,
  };
}
