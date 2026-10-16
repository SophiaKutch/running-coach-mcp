import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { rankByQuery } from "../rankByQuery.js";
import type { EmbeddedNote } from "../types.js";

/**
 * These tests use small, hand-built 2D "embeddings" rather than real
 * model output -- the point of rankByQuery is the ranking/filtering
 * logic, which is identical whether the vectors came from a real
 * sentence-embedding model or are made up by hand, as long as cosine
 * similarity between them means the same thing. This is what lets the
 * ranking logic be fully tested without the real embedding model, which
 * can't be installed in the sandbox this project was built in -- see
 * embeddings.ts and noteIndex.ts.
 */
function note(runId: string, embedding: number[], text = `note for ${runId}`): EmbeddedNote {
  return { runId, text, embedding };
}

describe("rankByQuery", () => {
  it("ranks by similarity, closest first", () => {
    const query = [1, 0];
    const notes = [
      note("far", [0, 1]), // orthogonal -> score 0
      note("exact", [1, 0]), // identical -> score 1
      note("close", [1, 0.2]), // mostly aligned
    ];

    const results = rankByQuery(notes, query, { minScore: -1 });
    assert.deepEqual(
      results.map((r) => r.runId),
      ["exact", "close", "far"]
    );
  });

  it("drops results under the minimum score instead of always returning something", () => {
    const query = [1, 0];
    const notes = [note("unrelated", [0, 1])]; // orthogonal, score 0

    const results = rankByQuery(notes, query, { minScore: 0.3 });
    assert.deepEqual(results, []);
  });

  it("respects the default minimum score when none is given", () => {
    const query = [1, 0];
    const notes = [note("unrelated", [-1, 0.01])]; // nearly opposite

    const results = rankByQuery(notes, query);
    assert.deepEqual(results, []);
  });

  it("respects limit", () => {
    const query = [1, 0];
    const notes = [note("a", [1, 0]), note("b", [1, 0.01]), note("c", [1, 0.02]), note("d", [1, 0.03])];

    const results = rankByQuery(notes, query, { limit: 2, minScore: -1 });
    assert.equal(results.length, 2);
  });

  it("carries the note's text through to the result", () => {
    const query = [1, 0];
    const notes = [note("a", [1, 0], "felt great today")];

    const results = rankByQuery(notes, query, { minScore: -1 });
    assert.equal(results[0]!.text, "felt great today");
  });

  it("returns an empty array for an empty note set", () => {
    assert.deepEqual(rankByQuery([], [1, 0]), []);
  });
});
