import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cosineSimilarity } from "../cosineSimilarity.js";

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    assert.equal(cosineSimilarity([1, 2, 3], [1, 2, 3]), 1);
  });

  it("returns 1 for parallel vectors of different magnitude (direction only, not length)", () => {
    const sim = cosineSimilarity([1, 2, 3], [2, 4, 6]);
    assert.ok(Math.abs(sim - 1) < 1e-9, `expected ~1, got ${sim}`);
  });

  it("returns 0 for orthogonal vectors", () => {
    assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
  });

  it("returns -1 for opposite vectors", () => {
    const sim = cosineSimilarity([1, 2], [-1, -2]);
    assert.ok(Math.abs(sim - -1) < 1e-9, `expected ~-1, got ${sim}`);
  });

  it("returns a value strictly between 0 and 1 for a partial match", () => {
    const sim = cosineSimilarity([1, 1, 0], [1, 0, 0]);
    assert.ok(sim > 0 && sim < 1, `expected (0,1), got ${sim}`);
  });

  it("returns 0 for a zero vector instead of dividing by zero", () => {
    assert.equal(cosineSimilarity([0, 0, 0], [1, 2, 3]), 0);
  });

  it("returns 0 for two zero vectors", () => {
    assert.equal(cosineSimilarity([0, 0], [0, 0]), 0);
  });

  it("throws on mismatched vector lengths rather than silently truncating", () => {
    assert.throws(() => cosineSimilarity([1, 2, 3], [1, 2]), /length mismatch/);
  });

  it("returns 0 for empty vectors", () => {
    assert.equal(cosineSimilarity([], []), 0);
  });
});
