import type { Run, RunType } from "../data/types.js";
import { distanceMiles, formatPace, paceSecondsPerMile } from "../data/derived.js";
import type {
  HeartRateZoneResult,
  LongRunWeek,
  PaceTrendResult,
  PersonalRecords,
  TrainingLoad,
  WeeklyMileage,
} from "../analysis/types.js";
import type { PeriodComparison } from "../analysis/comparePeriods.js";

/**
 * This whole file is pure, dependency-free, and unit tested on its own:
 * every MCP tool handler's job is to call an analysis function and then
 * hand its result to one of these formatters, so the actual "what does
 * this number mean in English" logic can be verified without the MCP SDK
 * installed at all.
 */

const METERS_PER_FOOT = 0.3048;

export interface RunView {
  id: string;
  date: string;
  name?: string;
  type: RunType;
  distanceMiles: number;
  movingTimeSeconds: number;
  paceSecondsPerMile?: number;
  paceFormatted: string;
  averageHeartRate?: number;
  elevationGainFeet?: number;
}

export function toRunView(run: Run): RunView {
  const pace = paceSecondsPerMile(run);
  return {
    id: run.id,
    date: run.date,
    name: run.name,
    type: run.type,
    distanceMiles: round(distanceMiles(run), 2),
    movingTimeSeconds: run.movingTimeSeconds,
    paceSecondsPerMile: pace !== undefined ? round(pace, 1) : undefined,
    paceFormatted: formatPace(pace),
    averageHeartRate: run.averageHeartRate,
    elevationGainFeet:
      run.elevationGainMeters !== undefined ? round(run.elevationGainMeters / METERS_PER_FOOT, 0) : undefined,
  };
}

export function formatRunLine(run: Run): string {
  const view = toRunView(run);
  const parts = [
    view.date,
    view.name ?? humanizeType(view.type),
    `${view.distanceMiles.toFixed(2)} mi`,
    `@ ${view.paceFormatted}/mi`,
  ];
  if (view.averageHeartRate !== undefined) {
    parts.push(`avg HR ${Math.round(view.averageHeartRate)}`);
  }
  if (view.elevationGainFeet !== undefined) {
    parts.push(`+${Math.round(view.elevationGainFeet)} ft gain`);
  }
  return parts.join(" — ");
}

export function formatRunsList(runs: Run[]): string {
  if (runs.length === 0) return "No runs matched.";
  return runs.map(formatRunLine).join("\n");
}

export function formatWeeklyMileage(week: WeeklyMileage): string {
  return (
    `Week of ${week.weekStart} to ${week.weekEnd}: ${week.runCount} run(s), ` +
    `${week.totalMiles.toFixed(1)} mi, ${formatDuration(week.totalMovingTimeSeconds)} moving time`
  );
}

export function formatWeeklyMileageTable(weeks: WeeklyMileage[]): string {
  if (weeks.length === 0) return "No runs in the training log.";
  const header = "| Week Of | Runs | Miles | Moving Time |\n|---|---|---|---|";
  const rows = weeks.map(
    (w) => `| ${w.weekStart} | ${w.runCount} | ${w.totalMiles.toFixed(1)} | ${formatDuration(w.totalMovingTimeSeconds)} |`
  );
  return [header, ...rows].join("\n");
}

export function formatLongRunWeek(week: LongRunWeek): string {
  return (
    `Longest run the week of ${week.weekStart}: ${week.longestRunMiles.toFixed(1)} mi ` +
    `(${week.longestRun.name ?? humanizeType(week.longestRun.type)}). ` +
    `Longest run to date: ${week.cumulativeLongestMiles.toFixed(1)} mi.`
  );
}

export function formatPaceTrend(result: PaceTrendResult): string {
  if (result.trend === "insufficient-data") {
    return "Not enough weeks of data yet to call a pace trend (need at least 3).";
  }
  const direction =
    result.trend === "improving" ? "getting faster" : result.trend === "declining" ? "getting slower" : "holding steady";
  const slope = result.slopeSecondsPerMilePerWeek!;
  return (
    `Pace is ${direction} (${result.trend}): about ${Math.abs(slope).toFixed(1)} sec/mile ` +
    `${slope < 0 ? "faster" : "slower"} per week, based on ${result.weeks.length} week(s) of data.`
  );
}

export function formatHeartRateZones(result: HeartRateZoneResult): string {
  const lines = result.zones
    .filter((z) => z.runCount > 0)
    .map(
      (z) =>
        `Zone ${z.zone} (${z.rangeLabel} of max HR): ${z.runCount} run(s), ${z.totalMiles.toFixed(1)} mi, ` +
        `${formatDuration(z.totalMovingTimeSeconds)}`
    );
  if (lines.length === 0) {
    return "No runs had heart rate data to classify.";
  }
  if (result.runsWithoutHeartRate > 0) {
    lines.push(
      `(${result.runsWithoutHeartRate} run(s) had no recorded heart rate and were left out of this breakdown.)`
    );
  }
  return lines.join("\n");
}

export function formatTrainingLoad(result: TrainingLoad): string {
  if (result.classification === "insufficient-data") {
    return "Not enough recent training history to compute a training load ratio.";
  }
  const ratio = result.ratio!;
  const narrative: Record<Exclude<TrainingLoad["classification"], "insufficient-data">, string> = {
    low: "well below your recent baseline -- you may be undertrained or tapering.",
    sustainable: "in a sustainable range relative to your recent baseline.",
    elevated: "elevated relative to your recent baseline -- worth monitoring.",
    "high-risk": "sharply higher than your recent baseline -- a pattern sports-science research associates with higher injury risk.",
  };
  return (
    `As of ${result.asOfDate}: ${result.acuteMinutes.toFixed(0)} min in the last 7 days vs. a ` +
    `${result.chronicWeeklyAverageMinutes.toFixed(0)} min/week baseline over the last 28 days ` +
    `(ratio ${ratio.toFixed(2)}). That's ${narrative[result.classification]} ` +
    `This is a general training heuristic, not personalized medical or coaching advice.`
  );
}

export function formatComparePeriods(result: PeriodComparison): string {
  const { periodA, periodB, deltas } = result;
  const milesDirection = deltas.totalMilesDelta >= 0 ? "more" : "less";
  const lines = [
    `${periodA.start} to ${periodA.end}: ${periodA.runCount} run(s), ${periodA.totalMiles.toFixed(1)} mi` +
      (periodA.averagePaceSecondsPerMile !== undefined ? `, avg pace ${formatPace(periodA.averagePaceSecondsPerMile)}/mi` : ""),
    `${periodB.start} to ${periodB.end}: ${periodB.runCount} run(s), ${periodB.totalMiles.toFixed(1)} mi` +
      (periodB.averagePaceSecondsPerMile !== undefined ? `, avg pace ${formatPace(periodB.averagePaceSecondsPerMile)}/mi` : ""),
    `Difference: ${Math.abs(deltas.totalMilesDelta).toFixed(1)} mi ${milesDirection} in the first period ` +
      `(${deltas.runCountDelta >= 0 ? "+" : ""}${deltas.runCountDelta} run(s)).`,
  ];
  if (deltas.averagePaceSecondsPerMileDelta !== undefined) {
    const paceDirection = deltas.averagePaceSecondsPerMileDelta < 0 ? "faster" : "slower";
    lines.push(
      `Pace was ${Math.abs(deltas.averagePaceSecondsPerMileDelta).toFixed(1)} sec/mile ${paceDirection} in the first period.`
    );
  }
  return lines.join("\n");
}

export function formatPersonalRecords(result: PersonalRecords): string {
  const lines: string[] = [];

  if (result.longestRun) {
    lines.push(`Longest run: ${formatRunLine(result.longestRun)}`);
  }
  if (result.fastestOverallPace) {
    lines.push(
      `Fastest sustained pace (≥1 mi): ${formatPace(result.fastestOverallPace.paceSecondsPerMile)}/mi ` +
        `(${formatRunLine(result.fastestOverallPace.run)})`
    );
  }
  for (const [distance, effort] of Object.entries(result.bestEffortsByDistance)) {
    if (!effort) continue;
    lines.push(`Best ${distance}: ${formatRaceTime(effort.timeSeconds)} (${formatRunLine(effort.run)})`);
  }
  if (result.highestMileageWeek) {
    lines.push(
      `Highest-mileage week: ${result.highestMileageWeek.totalMiles.toFixed(1)} mi ` +
        `(week of ${result.highestMileageWeek.weekStart})`
    );
  }

  return lines.length > 0 ? lines.join("\n") : "No runs in the training log yet.";
}

function humanizeType(type: RunType): string {
  switch (type) {
    case "run":
      return "Run";
    case "trail_run":
      return "Trail Run";
    case "treadmill_run":
      return "Treadmill Run";
    case "race":
      return "Race";
  }
}

export function formatDuration(totalSeconds: number): string {
  const totalMinutes = Math.round(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h${minutes.toString().padStart(2, "0")}m` : `${minutes}m`;
}

/**
 * Second-precision "mm:ss" (or "h:mm:ss") formatting for a race/effort time.
 * `formatDuration` above rounds to the nearest minute, which is fine for a
 * weekly moving-time total but was silently throwing away exactly the
 * precision a runner cares about on a personal-record time (a 24:27 5K
 * becoming "24m" loses real information) -- this exists specifically so
 * `formatPersonalRecords` doesn't make that mistake.
 */
export function formatRaceTime(totalSeconds: number): string {
  const rounded = Math.round(totalSeconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const seconds = rounded % 60;
  const minutesLabel = hours > 0 ? minutes.toString().padStart(2, "0") : minutes.toString();
  const secondsLabel = seconds.toString().padStart(2, "0");
  return hours > 0 ? `${hours}:${minutesLabel}:${secondsLabel}` : `${minutesLabel}:${secondsLabel}`;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
