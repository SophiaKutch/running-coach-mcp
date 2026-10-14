import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { findRuns } from "../findRuns.js";
import { makeRun } from "./testUtils.js";

const MILE = 1609.344;

describe("findRuns", () => {
  const runs = [
    makeRun({ id: "short-fast", date: "2026-01-05", distanceMeters: 3 * MILE, movingTimeSeconds: 3 * 420, type: "run" }),
    makeRun({ id: "long-slow", date: "2026-02-10", distanceMeters: 12 * MILE, movingTimeSeconds: 12 * 600, type: "run" }),
    makeRun({ id: "trail", date: "2026-03-01", distanceMeters: 6 * MILE, movingTimeSeconds: 6 * 540, type: "trail_run" }),
  ];

  it("returns everything when no filter is given", () => {
    assert.equal(findRuns(runs).length, 3);
  });

  it("filters by date range", () => {
    const result = findRuns(runs, { startDate: "2026-02-01", endDate: "2026-02-28" });
    assert.deepEqual(result.map((r) => r.id), ["long-slow"]);
  });

  it("filters by distance range", () => {
    const result = findRuns(runs, { minDistanceMiles: 5, maxDistanceMiles: 8 });
    assert.deepEqual(result.map((r) => r.id), ["trail"]);
  });

  it("filters by pace range (faster-or-equal / slower-or-equal bounds)", () => {
    // short-fast: 420 sec/mi, long-slow: 600 sec/mi, trail: 540 sec/mi
    const result = findRuns(runs, { maxPaceSecondsPerMile: 500 });
    assert.deepEqual(result.map((r) => r.id), ["short-fast"]);
  });

  it("filters by activity type", () => {
    const result = findRuns(runs, { type: "trail_run" });
    assert.deepEqual(result.map((r) => r.id), ["trail"]);
  });

  it("combines multiple filters with AND semantics", () => {
    const result = findRuns(runs, { minDistanceMiles: 1, maxPaceSecondsPerMile: 550 });
    assert.deepEqual(
      result.map((r) => r.id).sort(),
      ["short-fast", "trail"]
    );
  });
});
