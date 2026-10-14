import type { Run } from "./types.js";

const METERS_PER_MILE = 1609.344;
const METERS_PER_KM = 1000;

export function distanceMiles(run: Run): number {
  return run.distanceMeters / METERS_PER_MILE;
}

export function distanceKm(run: Run): number {
  return run.distanceMeters / METERS_PER_KM;
}

/** Pace in seconds per mile, based on moving time (excludes paused time). */
export function paceSecondsPerMile(run: Run): number | undefined {
  const miles = distanceMiles(run);
  if (miles <= 0) return undefined;
  return run.movingTimeSeconds / miles;
}

/** Pace in seconds per kilometer, based on moving time. */
export function paceSecondsPerKm(run: Run): number | undefined {
  const km = distanceKm(run);
  if (km <= 0) return undefined;
  return run.movingTimeSeconds / km;
}

/** Formats a pace (seconds per unit) as "m:ss", e.g. 465 -> "7:45". */
export function formatPace(secondsPerUnit: number | undefined): string {
  if (secondsPerUnit === undefined || !Number.isFinite(secondsPerUnit)) {
    return "--";
  }
  const totalSeconds = Math.round(secondsPerUnit);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
