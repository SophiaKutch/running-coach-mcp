import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { personalRecords } from "../personalRecords.js";
import { makeRun } from "./testUtils.js";

describe("personalRecords", () => {
  it("returns empty-but-defined results for no runs", () => {
    const result = personalRecords([]);
    assert.equal(result.longestRun, undefined);
    assert.equal(result.fastestOverallPace, undefined);
    assert.equal(result.highestMileageWeek, undefined);
    assert.deepEqual(result.bestEffortsByDistance, {});
  });

  it("finds the longest run, the fastest *representative* pace, best efforts by distance, and the highest-mileage week", () => {
    const runs = [
      // Very short and very fast -- should NOT win "fastest overall pace".
      makeRun({ id: "short", date: "2026-01-05", distanceMeters: 400, movingTimeSeconds: 60 }),
      makeRun({ id: "oneMile", date: "2026-01-06", distanceMeters: 1609.344, movingTimeSeconds: 500 }),
      makeRun({ id: "fiveK_a", date: "2026-01-07", distanceMeters: 5050, movingTimeSeconds: 1200 }),
      makeRun({ id: "fiveK_b", date: "2026-01-08", distanceMeters: 4900, movingTimeSeconds: 1100 }),
      makeRun({ id: "tenK", date: "2026-01-12", distanceMeters: 10000, movingTimeSeconds: 2400 }),
      makeRun({ id: "half", date: "2026-01-19", distanceMeters: 21097.5, movingTimeSeconds: 5400 }),
      makeRun({ id: "full", date: "2026-01-26", distanceMeters: 42195, movingTimeSeconds: 10800 }),
    ];

    const result = personalRecords(runs);

    assert.equal(result.longestRun!.id, "full");

    // fiveK_b (361 sec/mi) beats every other run at-or-above the 1-mile
    // floor, even though the untracked 400m "short" run was faster still.
    assert.equal(result.fastestOverallPace!.run.id, "fiveK_b");

    assert.equal(result.bestEffortsByDistance["5K"]!.run.id, "fiveK_b");
    assert.equal(result.bestEffortsByDistance["10K"]!.run.id, "tenK");
    assert.equal(result.bestEffortsByDistance["Half Marathon"]!.run.id, "half");
    assert.equal(result.bestEffortsByDistance["Marathon"]!.run.id, "full");

    // The marathon week dwarfs every other week's combined mileage.
    assert.equal(result.highestMileageWeek!.weekStart, "2026-01-26");
    assert.ok(Math.abs(result.highestMileageWeek!.totalMiles - 42195 / 1609.344) < 0.01);
  });
});
