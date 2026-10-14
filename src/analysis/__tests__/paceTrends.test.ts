import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { paceTrends } from "../paceTrends.js";
import { makeRun } from "./testUtils.js";

const ONE_MILE_METERS = 1609.344;
const WEEK_STARTS = ["2026-01-05", "2026-01-12", "2026-01-19", "2026-01-26"];

/** One exactly-one-mile run per week, so pace (sec/mile) === movingTimeSeconds. */
function weeklyPaceRuns(paces: number[]) {
  return paces.map((pace, i) =>
    makeRun({
      id: `week-${i}`,
      date: WEEK_STARTS[i]!,
      distanceMeters: ONE_MILE_METERS,
      movingTimeSeconds: pace,
    })
  );
}

describe("paceTrends", () => {
  it("computes time-weighted weekly pace", () => {
    const runs = [
      makeRun({ date: "2026-01-05", distanceMeters: ONE_MILE_METERS, movingTimeSeconds: 600 }),
      makeRun({ date: "2026-01-06", distanceMeters: ONE_MILE_METERS * 2, movingTimeSeconds: 1000 }),
    ];
    const result = paceTrends(runs);
    // total 3 miles in 1600s = 533.33 sec/mile, not the simple average of 600 and 500.
    assert.ok(Math.abs(result.weeks[0]!.averagePaceSecondsPerMile! - 1600 / 3) < 0.001);
  });

  it("classifies a clearly improving trend (pace dropping steadily)", () => {
    const result = paceTrends(weeklyPaceRuns([600, 580, 560, 540]));
    assert.equal(result.trend, "improving");
    assert.ok(result.slopeSecondsPerMilePerWeek! < -1.5);
    assert.ok(Math.abs(result.slopeSecondsPerMilePerWeek! - -20) < 0.001);
  });

  it("classifies a clearly declining trend (pace rising steadily)", () => {
    const result = paceTrends(weeklyPaceRuns([540, 560, 580, 600]));
    assert.equal(result.trend, "declining");
    assert.ok(result.slopeSecondsPerMilePerWeek! > 1.5);
  });

  it("classifies a flat trend as stable", () => {
    const result = paceTrends(weeklyPaceRuns([600, 601, 599, 600]));
    assert.equal(result.trend, "stable");
  });

  it("reports insufficient-data with fewer than 3 weeks", () => {
    const result = paceTrends(weeklyPaceRuns([600, 580]));
    assert.equal(result.trend, "insufficient-data");
    assert.equal(result.slopeSecondsPerMilePerWeek, undefined);
  });
});
