import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolvePeriodRanges } from "../comparePeriodsHelper.js";
import { makeRun } from "../../analysis/__tests__/testUtils.js";

describe("resolvePeriodRanges", () => {
  it("uses explicit dates when all four are given", () => {
    const result = resolvePeriodRanges([makeRun({ date: "2026-01-01" })], {
      periodAStart: "2026-02-01",
      periodAEnd: "2026-02-28",
      periodBStart: "2026-01-01",
      periodBEnd: "2026-01-31",
    });
    assert.deepEqual(result, {
      rangeA: { start: "2026-02-01", end: "2026-02-28" },
      rangeB: { start: "2026-01-01", end: "2026-01-31" },
    });
  });

  it("defaults to the last windowDays vs. the windowDays before that, anchored on the latest run", () => {
    const result = resolvePeriodRanges([makeRun({ date: "2026-03-01" })], { windowDays: 10 });
    assert.deepEqual(result, {
      rangeA: { start: "2026-02-20", end: "2026-03-01" },
      rangeB: { start: "2026-02-10", end: "2026-02-19" },
    });
  });

  it("defaults windowDays to 28 when not given", () => {
    const result = resolvePeriodRanges([makeRun({ date: "2026-03-01" })], {});
    assert.equal(result!.rangeA.start, "2026-02-02");
    assert.equal(result!.rangeA.end, "2026-03-01");
  });

  it("returns undefined when there are no runs to anchor a default window on", () => {
    assert.equal(resolvePeriodRanges([], {}), undefined);
  });
});
