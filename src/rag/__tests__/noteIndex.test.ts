import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { noteText, buildNoteIndex, searchNotes } from "../noteIndex.js";
import type { Run } from "../../data/types.js";

function makeRun(overrides: Partial<Run> = {}): Run {
  return {
    id: "1",
    date: "2026-01-01",
    type: "run",
    distanceMeters: 5000,
    movingTimeSeconds: 1500,
    elapsedTimeSeconds: 1500,
    source: "strava",
    ...overrides,
  };
}

describe("noteText", () => {
  it("joins name and description when both are present", () => {
    assert.equal(
      noteText(makeRun({ name: "Trail Run", description: "Muddy and slow" })),
      "Trail Run. Muddy and slow"
    );
  });

  it("uses just the name when there's no description", () => {
    assert.equal(noteText(makeRun({ name: "Easy Run" })), "Easy Run");
  });

  it("uses just the description when there's no name", () => {
    assert.equal(noteText(makeRun({ description: "Felt great" })), "Felt great");
  });

  it("returns undefined when there's neither", () => {
    assert.equal(noteText(makeRun()), undefined);
  });

  it("returns undefined for a name/description that's only whitespace", () => {
    assert.equal(noteText(makeRun({ name: "  ", description: "" })), undefined);
  });
});

describe("buildNoteIndex", () => {
  let tmpDir: string;
  after(() => {
    if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
  });

  function freshCachePath(): string {
    tmpDir = mkdtempSync(path.join(tmpdir(), "note-index-test-"));
    return path.join(tmpDir, "cache.json");
  }

  it("skips runs with no indexable text entirely", async () => {
    const runs = [makeRun({ id: "a" }), makeRun({ id: "b", name: "Easy Run" })];
    let embedCalls = 0;
    const index = await buildNoteIndex(runs, {
      cachePath: freshCachePath(),
      embedBatchFn: async (texts) => {
        embedCalls++;
        return texts.map(() => [1, 0]);
      },
    });
    assert.equal(index.length, 1);
    assert.equal(index[0]!.runId, "b");
    assert.equal(embedCalls, 1);
  });

  it("embeds on a cold cache, then reuses the cache on a second build without re-embedding", async () => {
    const cachePath = freshCachePath();
    const runs = [makeRun({ id: "a", name: "Trail Run", description: "muddy" })];
    let embedCalls = 0;
    const embedBatchFn = async (texts: string[]) => {
      embedCalls++;
      return texts.map(() => [0.5, 0.5]);
    };

    const first = await buildNoteIndex(runs, { cachePath, embedBatchFn });
    assert.equal(embedCalls, 1);
    assert.equal(first.length, 1);

    const second = await buildNoteIndex(runs, { cachePath, embedBatchFn });
    assert.equal(embedCalls, 1, "second build should hit the cache, not call embedBatchFn again");
    assert.deepEqual(second[0]!.embedding, first[0]!.embedding);
  });

  it("re-embeds only the run whose note text actually changed", async () => {
    const cachePath = freshCachePath();
    let embedCalls = 0;
    const embedBatchFn = async (texts: string[]) => {
      embedCalls++;
      return texts.map(() => [1, 1]);
    };

    await buildNoteIndex(
      [makeRun({ id: "a", name: "Easy Run" }), makeRun({ id: "b", name: "Long Run" })],
      { cachePath, embedBatchFn }
    );
    assert.equal(embedCalls, 1);

    // "a" unchanged, "b" edited -- only "b" should need re-embedding.
    await buildNoteIndex(
      [makeRun({ id: "a", name: "Easy Run" }), makeRun({ id: "b", name: "Long Run", description: "new note" })],
      { cachePath, embedBatchFn }
    );
    assert.equal(embedCalls, 2);
  });

  it("persists the cache to disk so a later process can reuse it", async () => {
    const cachePath = freshCachePath();
    await buildNoteIndex([makeRun({ id: "a", name: "Easy Run" })], {
      cachePath,
      embedBatchFn: async (texts) => texts.map(() => [0.1, 0.2]),
    });
    const onDisk = JSON.parse(readFileSync(cachePath, "utf-8"));
    assert.equal(Object.keys(onDisk).length, 1);
  });

  it("starts fresh instead of throwing when the cache file is corrupted", async () => {
    const cachePath = freshCachePath();
    const index = await buildNoteIndex([makeRun({ id: "a", name: "Easy Run" })], {
      cachePath: path.join(tmpDir, "does-not-exist.json"),
      embedBatchFn: async (texts) => texts.map(() => [1, 0]),
    });
    assert.equal(index.length, 1);
  });
});

describe("searchNotes", () => {
  it("embeds the query and returns ranked, thresholded matches", async () => {
    const index = [
      { runId: "a", text: "knee hurt a bit", embedding: [1, 0] },
      { runId: "b", text: "felt amazing", embedding: [0, 1] },
    ];
    const results = await searchNotes(index, "my knee", {
      embedTextFn: async () => [1, 0],
      minScore: 0.5,
    });
    assert.equal(results.length, 1);
    assert.equal(results[0]!.runId, "a");
  });
});
