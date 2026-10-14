import type { Run } from "../../data/types.js";

let counter = 0;

/** Builds a Run fixture with sane defaults, overridable per test. */
export function makeRun(overrides: Partial<Run> = {}): Run {
  counter += 1;
  return {
    id: `test-run-${counter}`,
    date: "2026-01-05",
    type: "run",
    distanceMeters: 5000,
    movingTimeSeconds: 1500, // 5:00/km, ~8:03/mi
    elapsedTimeSeconds: 1510,
    source: "strava",
    ...overrides,
  };
}
