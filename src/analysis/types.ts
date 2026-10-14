import type { Run } from "../data/types.js";

export interface WeekWindow {
  weekStart: string;
  weekEnd: string;
}

export interface WeeklyMileage extends WeekWindow {
  totalMiles: number;
  totalKm: number;
  runCount: number;
  totalMovingTimeSeconds: number;
}

export interface WeeklyPace extends WeekWindow {
  /** Time-weighted average pace: total moving time / total distance for the week. */
  averagePaceSecondsPerMile: number | undefined;
  runCount: number;
}

export type PaceTrendDirection = "improving" | "stable" | "declining" | "insufficient-data";

export interface PaceTrendResult {
  weeks: WeeklyPace[];
  trend: PaceTrendDirection;
  /** Slope of the regression line fit to weekly pace, in seconds/mile per week. Negative = getting faster. */
  slopeSecondsPerMilePerWeek: number | undefined;
}

export type HeartRateZone = 1 | 2 | 3 | 4 | 5;

export interface HeartRateZoneSummary {
  zone: HeartRateZone;
  /** The % of max HR range this zone covers, e.g. "60-70%". */
  rangeLabel: string;
  runCount: number;
  totalMovingTimeSeconds: number;
  totalMiles: number;
}

export interface HeartRateZoneResult {
  zones: HeartRateZoneSummary[];
  /** Runs that had no average heart rate recorded and couldn't be classified. */
  runsWithoutHeartRate: number;
}

export interface LongRunWeek extends WeekWindow {
  longestRun: Run;
  longestRunMiles: number;
  /** The longest run across all weeks up to and including this one. */
  cumulativeLongestMiles: number;
}

export type TrainingLoadClassification =
  | "insufficient-data"
  | "low"
  | "sustainable"
  | "elevated"
  | "high-risk";

export interface TrainingLoad {
  asOfDate: string;
  /** Total moving minutes in the 7 days ending asOfDate. */
  acuteMinutes: number;
  /** Average weekly moving minutes over the 28 days ending asOfDate. */
  chronicWeeklyAverageMinutes: number;
  /** acuteMinutes / chronicWeeklyAverageMinutes — the acute:chronic workload ratio. */
  ratio: number | undefined;
  classification: TrainingLoadClassification;
}

export interface BestEffort {
  run: Run;
  timeSeconds: number;
}

export type StandardDistance = "5K" | "10K" | "Half Marathon" | "Marathon";

export interface PersonalRecords {
  longestRun?: Run;
  fastestOverallPace?: { run: Run; paceSecondsPerMile: number };
  bestEffortsByDistance: Partial<Record<StandardDistance, BestEffort>>;
  highestMileageWeek?: WeekWindow & { totalMiles: number };
}
