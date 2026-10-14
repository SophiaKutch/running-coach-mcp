import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildWeeklySummary } from "../weeklySummary.js";
import { makeRun } from "../../analysis/__tests__/testUtils.js";

const MILE = 1609.344;

describe("buildWeeklySummary", () => {
  it("reports an empty training log", () => {
    const result = buildWeeklySummary([]);
    assert.equal(result.text, "No runs in the training log.");
    assert.equal(result.isError, undefined);
  });

  it("defaults to the most recent week when no weekStart is given", () => {
    const runs = [
      makeRun({ date: "2026-01-05", distanceMeters: 5 * MILE, movingTimeSeconds: 5 * 480 }),
      makeRun({ date: "2026-01-12", distanceMeters: 8 * MILE, movingTimeSeconds: 8 * 480, name: "Long Run" }),
    ];
    const result = buildWeeklySummary(runs);
    assert.match(result.text, /2026-01-12 to 2026-01-18/);
    assert.match(result.text, /8\.0 mi/);
    assert.match(result.text, /Average pace: 8:00\/mi/);
    assert.match(result.text, /Long Run/);
  });

  it("flags a week with no runs as an error", () => {
    const runs = [makeRun({ date: "2026-01-05" })];
    const result = buildWeeklySummary(runs, { weekStart: "2026-03-02" }); // itself a Monday
    assert.equal(result.isError, true);
    assert.match(result.text, /No runs found for the week of 2026-03-02/);
  });

  it("includes a heart-rate zone breakdown only when maxHeartRate is given", () => {
    const runs = [makeRun({ date: "2026-01-05", averageHeartRate: 140 })];
    const withoutHr = buildWeeklySummary(runs, { weekStart: "2026-01-05" });
    assert.doesNotMatch(withoutHr.text, /Zone/);

    const withHr = buildWeeklySummary(runs, { weekStart: "2026-01-05", maxHeartRate: 190 });
    assert.match(withHr.text, /Zone 3/);
  });
});
