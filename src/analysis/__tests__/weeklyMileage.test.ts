import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { weeklyMileage } from "../weeklyMileage.js";
import { makeRun } from "./testUtils.js";

describe("weeklyMileage", () => {
  it("sums distance, time, and run count within a week", () => {
    const runs = [
      makeRun({ date: "2026-01-05", distanceMeters: 5000, movingTimeSeconds: 1500 }),
      makeRun({ date: "2026-01-07", distanceMeters: 8000, movingTimeSeconds: 2400 }),
    ];
    const weeks = weeklyMileage(runs);
    assert.equal(weeks.length, 1);
    const week = weeks[0]!;
    assert.equal(week.weekStart, "2026-01-05");
    assert.equal(week.weekEnd, "2026-01-11");
    assert.equal(week.runCount, 2);
    assert.equal(week.totalMovingTimeSeconds, 3900);
    assert.ok(Math.abs(week.totalKm - 13) < 0.001);
    assert.ok(Math.abs(week.totalMiles - 13 / 1.609344) < 0.001);
  });

  it("returns weeks in chronological order", () => {
    const runs = [
      makeRun({ date: "2026-02-02" }),
      makeRun({ date: "2026-01-05" }),
    ];
    const weeks = weeklyMileage(runs);
    assert.deepEqual(
      weeks.map((w) => w.weekStart),
      ["2026-01-05", "2026-02-02"]
    );
  });

  it("returns an empty array for no runs", () => {
    assert.deepEqual(weeklyMileage([]), []);
  });
});
