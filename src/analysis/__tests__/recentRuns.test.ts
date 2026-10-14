import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getRecentRuns } from "../recentRuns.js";
import { makeRun } from "./testUtils.js";

describe("getRecentRuns", () => {
  it("returns the N most recent runs, newest first", () => {
    const runs = [
      makeRun({ id: "oldest", date: "2026-01-01" }),
      makeRun({ id: "newest", date: "2026-03-01" }),
      makeRun({ id: "middle", date: "2026-02-01" }),
    ];
    const recent = getRecentRuns(runs, 2);
    assert.deepEqual(
      recent.map((r) => r.id),
      ["newest", "middle"]
    );
  });

  it("defaults to 10 when no limit is given", () => {
    const runs = Array.from({ length: 15 }, (_, i) =>
      makeRun({ id: `r${i}`, date: `2026-01-${String(i + 1).padStart(2, "0")}` })
    );
    assert.equal(getRecentRuns(runs).length, 10);
  });

  it("does not mutate the input array", () => {
    const runs = [makeRun({ date: "2026-01-01" }), makeRun({ date: "2026-02-01" })];
    const original = [...runs];
    getRecentRuns(runs, 1);
    assert.deepEqual(runs, original);
  });
});
