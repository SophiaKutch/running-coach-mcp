import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { longRunProgression } from "../longRunProgression.js";
import { makeRun } from "./testUtils.js";

const MILE = 1609.344;

describe("longRunProgression", () => {
  it("picks the longest run per week and tracks the cumulative longest", () => {
    const runs = [
      // Week 1: 5mi and 10mi -> longest 10mi
      makeRun({ id: "w1-a", date: "2026-01-05", distanceMeters: 5 * MILE }),
      makeRun({ id: "w1-b", date: "2026-01-06", distanceMeters: 10 * MILE }),
      // Week 2: 8mi only -> longest 8mi, but cumulative record stays 10mi
      makeRun({ id: "w2-a", date: "2026-01-12", distanceMeters: 8 * MILE }),
      // Week 3: 12mi -> new cumulative record
      makeRun({ id: "w3-a", date: "2026-01-19", distanceMeters: 12 * MILE }),
    ];

    const weeks = longRunProgression(runs);
    assert.equal(weeks.length, 3);

    assert.equal(weeks[0]!.longestRun.id, "w1-b");
    assert.ok(Math.abs(weeks[0]!.longestRunMiles - 10) < 0.001);
    assert.ok(Math.abs(weeks[0]!.cumulativeLongestMiles - 10) < 0.001);

    assert.equal(weeks[1]!.longestRun.id, "w2-a");
    assert.ok(Math.abs(weeks[1]!.longestRunMiles - 8) < 0.001);
    assert.ok(Math.abs(weeks[1]!.cumulativeLongestMiles - 10) < 0.001); // unchanged

    assert.equal(weeks[2]!.longestRun.id, "w3-a");
    assert.ok(Math.abs(weeks[2]!.cumulativeLongestMiles - 12) < 0.001); // new record
  });
});
