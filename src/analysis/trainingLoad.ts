import type { Run } from "../data/types.js";
import { addDays } from "./week.js";
import type { TrainingLoad, TrainingLoadClassification } from "./types.js";

/**
 * Acute:chronic workload ratio (ACWR): recent training volume (last 7 days)
 * divided by the longer-term baseline it's building on (average weekly
 * volume over the trailing 28 days). This is a well-known sports-science
 * heuristic for "how much has this week's load changed relative to what the
 * body is adapted to" — not a personalized medical assessment, and the
 * classification bands below are the commonly-cited rough bands from that
 * literature, not a guarantee about injury risk for any individual.
 *
 * We use moving-time minutes rather than distance as the load proxy: it
 * accounts for effort on slow trail runs and hills in a way raw mileage
 * doesn't, and it's directly available from every run without needing a
 * separate "effort" estimate.
 */
export function trainingLoad(runs: Run[], asOfDate?: string): TrainingLoad {
  const effectiveDate = asOfDate ?? latestRunDate(runs);
  if (!effectiveDate) {
    return {
      asOfDate: asOfDate ?? "",
      acuteMinutes: 0,
      chronicWeeklyAverageMinutes: 0,
      ratio: undefined,
      classification: "insufficient-data",
    };
  }

  const acuteWindowStart = addDays(effectiveDate, -6); // 7 days inclusive of asOfDate
  const chronicWindowStart = addDays(effectiveDate, -27); // 28 days inclusive of asOfDate

  let acuteSeconds = 0;
  let chronicSeconds = 0;

  for (const run of runs) {
    if (run.date > effectiveDate || run.date < chronicWindowStart) continue;
    chronicSeconds += run.movingTimeSeconds;
    if (run.date >= acuteWindowStart) {
      acuteSeconds += run.movingTimeSeconds;
    }
  }

  const acuteMinutes = acuteSeconds / 60;
  const chronicWeeklyAverageMinutes = chronicSeconds / 60 / 4;

  if (chronicWeeklyAverageMinutes === 0) {
    return {
      asOfDate: effectiveDate,
      acuteMinutes,
      chronicWeeklyAverageMinutes,
      ratio: undefined,
      classification: "insufficient-data",
    };
  }

  const ratio = acuteMinutes / chronicWeeklyAverageMinutes;
  return {
    asOfDate: effectiveDate,
    acuteMinutes,
    chronicWeeklyAverageMinutes,
    ratio,
    classification: classify(ratio),
  };
}

function classify(ratio: number): TrainingLoadClassification {
  if (ratio < 0.8) return "low";
  if (ratio <= 1.3) return "sustainable";
  if (ratio <= 1.5) return "elevated";
  return "high-risk";
}

function latestRunDate(runs: Run[]): string | undefined {
  let latest: string | undefined;
  for (const run of runs) {
    if (latest === undefined || run.date > latest) latest = run.date;
  }
  return latest;
}
