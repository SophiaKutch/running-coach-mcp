import type { Run } from "../data/types.js";
import { addDays, getRecentRuns } from "../analysis/index.js";
import type { PeriodRange } from "../analysis/comparePeriods.js";

export interface ComparePeriodsRequest {
  periodAStart?: string;
  periodAEnd?: string;
  periodBStart?: string;
  periodBEnd?: string;
  windowDays?: number;
}

/**
 * Resolves the compare_periods tool's input into two concrete date ranges:
 * explicit dates if all four are given, otherwise "last windowDays (default
 * 28) vs. the windowDays before that", anchored on the most recent run.
 * Returns undefined only when there's no data at all to anchor a default
 * window on. Split out from tools.ts for the same reason as
 * weeklySummary.ts -- so it's testable without the MCP SDK installed.
 */
export function resolvePeriodRanges(
  runs: Run[],
  request: ComparePeriodsRequest
): { rangeA: PeriodRange; rangeB: PeriodRange } | undefined {
  const { periodAStart, periodAEnd, periodBStart, periodBEnd, windowDays } = request;

  if (periodAStart && periodAEnd && periodBStart && periodBEnd) {
    return { rangeA: { start: periodAStart, end: periodAEnd }, rangeB: { start: periodBStart, end: periodBEnd } };
  }

  const latest = getRecentRuns(runs, 1)[0]?.date;
  if (!latest) return undefined;

  const days = windowDays ?? 28;
  return {
    rangeA: { start: addDays(latest, -(days - 1)), end: latest },
    rangeB: { start: addDays(latest, -(2 * days - 1)), end: addDays(latest, -days) },
  };
}
