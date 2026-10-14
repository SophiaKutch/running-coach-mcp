import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { comparePeriods } from "../comparePeriods.js";
import { makeRun } from "./testUtils.js";

const MILE = 1609.344;

describe("comparePeriods", () => {
  it("computes independent stats for each period and the deltas between them", () => {
    const runs = [
      // Period A (Feb): 2 runs, 10mi total, faster pace
      makeRun({ id: "a1", date: "2026-02-05", distanceMeters: 5 * MILE, movingTimeSeconds: 5 * 480 }),
      makeRun({ id: "a2", date: "2026-02-12", distanceMeters: 5 * MILE, movingTimeSeconds: 5 * 480 }),
      // Period B (Jan): 1 run, 5mi total, slower pace
      makeRun({ id: "b1", date: "2026-01-10", distanceMeters: 5 * MILE, movingTimeSeconds: 5 * 540 }),
      // Outside both periods
      makeRun({ id: "outside", date: "2026-03-20", distanceMeters: 100 * MILE }),
    ];

    const result = comparePeriods(
      runs,
      { start: "2026-02-01", end: "2026-02-28" },
      { start: "2026-01-01", end: "2026-01-31" }
    );

    assert.equal(result.periodA.runCount, 2);
    assert.ok(Math.abs(result.periodA.totalMiles - 10) < 0.01);
    assert.ok(Math.abs(result.periodA.averagePaceSecondsPerMile! - 480) < 0.01);

    assert.equal(result.periodB.runCount, 1);
    assert.ok(Math.abs(result.periodB.totalMiles - 5) < 0.01);
    assert.ok(Math.abs(result.periodB.averagePaceSecondsPerMile! - 540) < 0.01);

    assert.ok(Math.abs(result.deltas.totalMilesDelta - 5) < 0.01);
    assert.equal(result.deltas.runCountDelta, 1);
    // Period A was faster (lower sec/mile), so the delta should be negative.
    assert.ok(Math.abs(result.deltas.averagePaceSecondsPerMileDelta! - -60) < 0.01);
  });

  it("returns undefined pace deltas when a period has no runs", () => {
    const runs = [makeRun({ date: "2026-02-05" })];
    const result = comparePeriods(
      runs,
      { start: "2026-02-01", end: "2026-02-28" },
      { start: "2026-01-01", end: "2026-01-31" }
    );
    assert.equal(result.periodB.runCount, 0);
    assert.equal(result.periodB.averagePaceSecondsPerMile, undefined);
    assert.equal(result.deltas.averagePaceSecondsPerMileDelta, undefined);
  });
});
