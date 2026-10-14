import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { addDays, daysBetween, getWeekEnd, getWeekStart, groupByWeek } from "../week.js";
import { makeRun } from "./testUtils.js";

describe("getWeekStart", () => {
  it("returns the same Monday for every day in that week", () => {
    assert.equal(getWeekStart("2026-01-05"), "2026-01-05"); // Monday
    assert.equal(getWeekStart("2026-01-07"), "2026-01-05"); // Wednesday
    assert.equal(getWeekStart("2026-01-11"), "2026-01-05"); // Sunday
  });

  it("rolls over into the next week on Monday", () => {
    assert.equal(getWeekStart("2026-01-12"), "2026-01-12");
  });
});

describe("getWeekEnd", () => {
  it("returns the Sunday six days after the given Monday", () => {
    assert.equal(getWeekEnd("2026-01-05"), "2026-01-11");
  });
});

describe("addDays / daysBetween", () => {
  it("adds and subtracts days across month boundaries", () => {
    assert.equal(addDays("2026-01-30", 3), "2026-02-02");
    assert.equal(addDays("2026-02-02", -3), "2026-01-30");
  });

  it("computes an inclusive day difference", () => {
    assert.equal(daysBetween("2026-01-01", "2026-01-08"), 7);
  });
});

describe("groupByWeek", () => {
  it("buckets runs by Monday-start week and sorts weeks chronologically", () => {
    const runs = [
      makeRun({ id: "a", date: "2026-01-19" }),
      makeRun({ id: "b", date: "2026-01-06" }),
      makeRun({ id: "c", date: "2026-01-07" }),
    ];
    const weeks = groupByWeek(runs);
    assert.deepEqual([...weeks.keys()], ["2026-01-05", "2026-01-19"]);
    assert.equal(weeks.get("2026-01-05")!.length, 2);
    assert.equal(weeks.get("2026-01-19")!.length, 1);
  });
});
