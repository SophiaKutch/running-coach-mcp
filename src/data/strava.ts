import { readFileSync } from "node:fs";
import { parseCsv } from "./csv.js";
import type { NormalizeResult, Run, RunType, SkippedActivity } from "./types.js";

/**
 * Strava's bulk-export "Activity Type" values we treat as runs. Anything
 * else (Ride, Walk, Swim, Workout, ...) is recorded in `skipped` rather
 * than silently dropped, so a caller can see exactly what was excluded
 * and why — useful the first time someone points this at their own export
 * and the numbers look off.
 */
const RUN_TYPE_MAP: Record<string, RunType> = {
  Run: "run",
  "Trail Run": "trail_run",
  "Treadmill Run": "treadmill_run",
  Race: "race",
};

type StravaRow = Record<string, string | undefined>;

/**
 * Parses the CSV text of a Strava bulk-export `activities.csv`.
 *
 * Real Strava exports contain many more columns than we read here (gear,
 * calories, cadence, power, grade-adjusted pace, etc.), and depending on
 * export date some columns can even repeat with a numeric suffix. We only
 * read a stable subset by column name and ignore the rest — `parseCsv`
 * gives us a plain object per row keyed by header, so unknown columns just
 * aren't referenced. This keeps the parser from breaking every time Strava
 * adds a field, at the cost of ignoring data we don't need yet.
 */
export function parseStravaCsv(csvText: string): NormalizeResult {
  const rows: StravaRow[] = parseCsv(csvText);

  const runs: Run[] = [];
  const skipped: SkippedActivity[] = [];

  for (const row of rows) {
    const ref = row["Activity ID"] || row["Activity Name"] || "(unidentified row)";
    const activityType = row["Activity Type"]?.trim();
    const runType = activityType ? RUN_TYPE_MAP[activityType] : undefined;

    if (!runType) {
      skipped.push({
        ref,
        reason: `non-running activity type: ${activityType || "(missing)"}`,
      });
      continue;
    }

    const distanceMeters = toNumber(row["Distance"]);
    const movingTimeSeconds = toNumber(row["Moving Time"]);
    const elapsedTimeSeconds = toNumber(row["Elapsed Time"]);

    if (distanceMeters === undefined || movingTimeSeconds === undefined) {
      skipped.push({ ref, reason: "missing distance or moving time" });
      continue;
    }

    const date = parseStravaDate(row["Activity Date"]);
    if (!date) {
      skipped.push({
        ref,
        reason: `unparseable Activity Date: "${row["Activity Date"] ?? ""}"`,
      });
      continue;
    }

    runs.push({
      id: row["Activity ID"] || ref,
      date: date.dateOnly,
      startTime: date.iso,
      name: row["Activity Name"] || undefined,
      type: runType,
      distanceMeters,
      movingTimeSeconds,
      // Older/manual Strava entries sometimes omit Elapsed Time; moving
      // time is the closer approximation, not zero.
      elapsedTimeSeconds: elapsedTimeSeconds ?? movingTimeSeconds,
      averageHeartRate: toNumber(row["Average Heart Rate"]),
      maxHeartRate: toNumber(row["Max Heart Rate"]),
      elevationGainMeters: toNumber(row["Elevation Gain"]),
      source: "strava",
    });
  }

  runs.sort((a, b) => a.date.localeCompare(b.date));

  return { runs, skipped };
}

/** Convenience wrapper: read an `activities.csv` export off disk and normalize it. */
export function loadStravaCsvFile(filePath: string): NormalizeResult {
  const csvText = readFileSync(filePath, "utf-8");
  return parseStravaCsv(csvText);
}

function toNumber(value: string | undefined): number | undefined {
  if (value === undefined || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Strava's "Activity Date" column is a locale-formatted timestamp, e.g.
 * "Jan 5, 2026, 7:32:11 AM". We parse it defensively and return undefined
 * on anything unparseable (a known quirk of some older export rows) so
 * the caller can skip-and-record that row instead of crashing the whole
 * import or silently producing an Invalid Date downstream.
 */
function parseStravaDate(raw: string | undefined): { dateOnly: string; iso: string } | undefined {
  if (!raw) return undefined;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return {
    dateOnly: parsed.toISOString().slice(0, 10),
    iso: parsed.toISOString(),
  };
}
