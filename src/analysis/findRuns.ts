import type { Run, RunType } from "../data/types.js";
import { distanceMiles, paceSecondsPerMile } from "../data/derived.js";

export interface RunFilter {
  /** Inclusive, "yyyy-mm-dd". */
  startDate?: string;
  /** Inclusive, "yyyy-mm-dd". */
  endDate?: string;
  minDistanceMiles?: number;
  maxDistanceMiles?: number;
  /** Faster-or-equal bound: a pace of 480 is faster than 540. */
  minPaceSecondsPerMile?: number;
  maxPaceSecondsPerMile?: number;
  type?: RunType;
}

/**
 * Filters runs by any combination of date range, distance range, pace
 * range, and activity type. Every filter is optional and they combine with
 * AND semantics. A run with no computable pace (shouldn't happen for
 * normalized data, but the type allows it) is excluded by a pace filter
 * rather than treated as a non-match-proof wildcard.
 */
export function findRuns(runs: Run[], filter: RunFilter = {}): Run[] {
  return runs.filter((run) => {
    if (filter.startDate !== undefined && run.date < filter.startDate) return false;
    if (filter.endDate !== undefined && run.date > filter.endDate) return false;
    if (filter.type !== undefined && run.type !== filter.type) return false;

    if (filter.minDistanceMiles !== undefined || filter.maxDistanceMiles !== undefined) {
      const miles = distanceMiles(run);
      if (filter.minDistanceMiles !== undefined && miles < filter.minDistanceMiles) return false;
      if (filter.maxDistanceMiles !== undefined && miles > filter.maxDistanceMiles) return false;
    }

    if (filter.minPaceSecondsPerMile !== undefined || filter.maxPaceSecondsPerMile !== undefined) {
      const pace = paceSecondsPerMile(run);
      if (pace === undefined) return false;
      if (filter.minPaceSecondsPerMile !== undefined && pace < filter.minPaceSecondsPerMile) return false;
      if (filter.maxPaceSecondsPerMile !== undefined && pace > filter.maxPaceSecondsPerMile) return false;
    }

    return true;
  });
}
