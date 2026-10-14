import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { containsAll, containsAny, containsNumberNear, toolsCoverExpected } from "../grading.js";

describe("containsAll", () => {
  it("is case-insensitive and requires every substring", () => {
    assert.equal(containsAll("Your Longest Run was 13.1 miles", ["longest run", "13.1"]), true);
    assert.equal(containsAll("Your longest run was 13.1 miles", ["half marathon"]), false);
  });
});

describe("containsAny", () => {
  it("passes if at least one substring matches", () => {
    assert.equal(containsAny("sustainable range", ["elevated", "sustainable"]), true);
    assert.equal(containsAny("sustainable range", ["elevated", "high-risk"]), false);
  });
});

describe("containsNumberNear", () => {
  it("matches a number within tolerance regardless of surrounding text", () => {
    assert.equal(containsNumberNear("Your longest run was 13.11 mi on Sept 28", 13.1, 0.1), true);
  });
  it("fails when no number is close enough", () => {
    assert.equal(containsNumberNear("Your longest run was 8.0 mi", 13.1, 0.1), false);
  });
  it("fails on text with no numbers at all", () => {
    assert.equal(containsNumberNear("no numbers here", 13.1, 0.1), false);
  });
});

describe("toolsCoverExpected", () => {
  it("passes when every expected tool was called, extras allowed", () => {
    assert.equal(toolsCoverExpected(["find_runs", "get_recent_runs"], ["find_runs"]), true);
  });
  it("fails when an expected tool was never called", () => {
    assert.equal(toolsCoverExpected(["get_recent_runs"], ["find_runs"]), false);
  });
  it("passes trivially when nothing is expected", () => {
    assert.equal(toolsCoverExpected([], []), true);
  });
});
