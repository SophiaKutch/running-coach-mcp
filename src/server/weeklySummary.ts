import type { Run } from "../data/types.js";
import { formatPace } from "../data/derived.js";
import {
  findRuns,
  getWeekEnd,
  getWeekStart,
  heartRateZones,
  longRunProgression,
  paceTrends,
  weeklyMileage,
} from "../analysis/index.js";
import { formatHeartRateZones, formatLongRunWeek, formatWeeklyMileage } from "./formatting.js";

export interface WeeklySummaryOptions {
  /** Any date within the target week. Defaults to the most recent week with runs. */
  weekStart?: string;
  /** If given, includes a heart-rate zone breakdown for that week's runs. */
  maxHeartRate?: number;
}

export interface WeeklySummaryResult {
  text: string;
  isError?: boolean;
}

/**
 * Builds the weekly_summary tool's response text. Pulled out of
 * src/server/tools.ts (which imports the MCP SDK and so can't be run or
 * unit tested without it) so this orchestration logic -- and the exact
 * numbers it produces -- can be verified directly, including by the eval
 * ground-truth test.
 */
export function buildWeeklySummary(runs: Run[], options: WeeklySummaryOptions = {}): WeeklySummaryResult {
  const weeks = weeklyMileage(runs);
  if (weeks.length === 0) {
    return { text: "No runs in the training log." };
  }

  const targetWeekStart = options.weekStart ? getWeekStart(options.weekStart) : weeks[weeks.length - 1]!.weekStart;
  const mileageWeek = weeks.find((w) => w.weekStart === targetWeekStart);
  if (!mileageWeek) {
    return { text: `No runs found for the week of ${targetWeekStart}.`, isError: true };
  }

  const lines = [formatWeeklyMileage(mileageWeek)];

  const paceWeek = paceTrends(runs).weeks.find((w) => w.weekStart === targetWeekStart);
  if (paceWeek?.averagePaceSecondsPerMile !== undefined) {
    lines.push(`Average pace: ${formatPace(paceWeek.averagePaceSecondsPerMile)}/mi`);
  }

  const longRunWeek = longRunProgression(runs).find((w) => w.weekStart === targetWeekStart);
  if (longRunWeek) {
    lines.push(formatLongRunWeek(longRunWeek));
  }

  if (options.maxHeartRate !== undefined) {
    const weekRuns = findRuns(runs, { startDate: targetWeekStart, endDate: getWeekEnd(targetWeekStart) });
    lines.push(formatHeartRateZones(heartRateZones(weekRuns, options.maxHeartRate)));
  }

  return { text: lines.join("\n") };
}
