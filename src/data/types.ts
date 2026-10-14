/**
 * Canonical, source-agnostic representation of a single run.
 *
 * Design choice: store base SI quantities (meters, seconds) rather than
 * display units (miles, "7:45/mi"). Strava, Garmin, and Apple Health all
 * disagree on display units and on how they round pace, but they agree
 * (after parsing) on distance-and-time. Keeping one canonical shape here
 * means every analysis function in Phase 2 works the same way regardless
 * of which export produced the data, and display formatting (miles vs km,
 * pace strings) stays a presentation concern instead of leaking into the
 * data layer. Derived values like pace are computed on demand — see
 * `derived.ts` — rather than stored, so they can never drift out of sync
 * with distance/time.
 */
export interface Run {
  /** Stable identifier from the source platform (e.g. Strava activity id). */
  id: string;
  /** ISO 8601 date string (yyyy-mm-dd) — the calendar day the run happened. */
  date: string;
  /** ISO 8601 timestamp for the exact start time, when the source provides one. */
  startTime?: string;
  /** Human-readable activity name/title from the source, if any. */
  name?: string;
  /** Normalized activity type. Only "run" variants should reach this type. */
  type: RunType;
  distanceMeters: number;
  movingTimeSeconds: number;
  elapsedTimeSeconds: number;
  averageHeartRate?: number;
  maxHeartRate?: number;
  elevationGainMeters?: number;
  /** Where this run's data originally came from. */
  source: "strava" | "garmin" | "apple_health" | "manual";
}

export type RunType = "run" | "trail_run" | "treadmill_run" | "race";

/** The result of normalizing a raw export: clean runs plus anything we skipped. */
export interface NormalizeResult {
  runs: Run[];
  skipped: SkippedActivity[];
}

export interface SkippedActivity {
  /** Original identifier/row reference, for debugging a specific export. */
  ref: string;
  /** Why it was excluded — e.g. "non-running activity type: Ride". */
  reason: string;
}
