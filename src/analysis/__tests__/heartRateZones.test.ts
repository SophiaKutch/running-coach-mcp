import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { heartRateZones } from "../heartRateZones.js";
import { makeRun } from "./testUtils.js";

const MAX_HR = 190;

describe("heartRateZones", () => {
  it("classifies runs into the correct zone based on % of max HR", () => {
    const runs = [
      makeRun({ averageHeartRate: 100, movingTimeSeconds: 1000 }), // 52.6% -> zone 1
      makeRun({ averageHeartRate: 120, movingTimeSeconds: 1000 }), // 63.2% -> zone 2
      makeRun({ averageHeartRate: 140, movingTimeSeconds: 1000 }), // 73.7% -> zone 3
      makeRun({ averageHeartRate: 160, movingTimeSeconds: 1000 }), // 84.2% -> zone 4
      makeRun({ averageHeartRate: 180, movingTimeSeconds: 1000 }), // 94.7% -> zone 5
    ];
    const result = heartRateZones(runs, MAX_HR);
    for (const zone of result.zones) {
      assert.equal(zone.runCount, 1, `zone ${zone.zone} should have exactly 1 run`);
    }
    assert.equal(result.runsWithoutHeartRate, 0);
  });

  it("counts runs with no recorded heart rate instead of misclassifying them", () => {
    const runs = [makeRun({ averageHeartRate: undefined }), makeRun({ averageHeartRate: 150 })];
    const result = heartRateZones(runs, MAX_HR);
    assert.equal(result.runsWithoutHeartRate, 1);
    const totalClassified = result.zones.reduce((sum, z) => sum + z.runCount, 0);
    assert.equal(totalClassified, 1);
  });

  it("rejects a non-positive max heart rate", () => {
    assert.throws(() => heartRateZones([makeRun()], 0));
  });
});
