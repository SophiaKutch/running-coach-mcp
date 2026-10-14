import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { trainingLoad } from "../trainingLoad.js";
import { makeRun } from "./testUtils.js";

const AS_OF = "2026-01-28"; // acute window: 01-22..01-28; chronic window: 01-01..01-28

describe("trainingLoad", () => {
  it("classifies a steady, unchanged load as sustainable (ratio ~= 1.0)", () => {
    const runs = [
      makeRun({ date: "2026-01-01", movingTimeSeconds: 1800 }),
      makeRun({ date: "2026-01-08", movingTimeSeconds: 1800 }),
      makeRun({ date: "2026-01-15", movingTimeSeconds: 1800 }),
      makeRun({ date: "2026-01-22", movingTimeSeconds: 1800 }), // in acute window
    ];
    const result = trainingLoad(runs, AS_OF);
    assert.equal(result.classification, "sustainable");
    assert.ok(Math.abs(result.ratio! - 1.0) < 0.001);
  });

  it("classifies a sharp recent spike as high-risk", () => {
    const runs = [
      makeRun({ date: "2026-01-01", movingTimeSeconds: 1800 }),
      makeRun({ date: "2026-01-08", movingTimeSeconds: 1800 }),
      makeRun({ date: "2026-01-15", movingTimeSeconds: 1800 }),
      makeRun({ date: "2026-01-22", movingTimeSeconds: 9000 }), // big spike in acute window
    ];
    const result = trainingLoad(runs, AS_OF);
    assert.equal(result.classification, "high-risk");
    assert.ok(result.ratio! > 1.5);
  });

  it("classifies a sharp recent drop as low", () => {
    const runs = [
      makeRun({ date: "2026-01-01", movingTimeSeconds: 3600 }),
      makeRun({ date: "2026-01-08", movingTimeSeconds: 3600 }),
      makeRun({ date: "2026-01-15", movingTimeSeconds: 3600 }),
      makeRun({ date: "2026-01-22", movingTimeSeconds: 600 }), // tapering/rest
    ];
    const result = trainingLoad(runs, AS_OF);
    assert.equal(result.classification, "low");
    assert.ok(result.ratio! < 0.8);
  });

  it("reports insufficient-data with no runs at all", () => {
    const result = trainingLoad([], AS_OF);
    assert.equal(result.classification, "insufficient-data");
    assert.equal(result.ratio, undefined);
  });

  it("defaults asOfDate to the most recent run when not provided", () => {
    const result = trainingLoad([makeRun({ date: "2026-03-01", movingTimeSeconds: 1800 })]);
    assert.equal(result.asOfDate, "2026-03-01");
  });
});
