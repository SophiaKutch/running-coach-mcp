import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Run } from "../data/types.js";
import { embedBatch as realEmbedBatch, embedText as realEmbedText } from "./embeddings.js";
import { rankByQuery, type RankOptions } from "./rankByQuery.js";
import type { EmbeddedNote, NoteMatch } from "./types.js";

/** Where to go looking for runs with something worth indexing. */
const DEFAULT_CACHE_PATH = path.join(process.cwd(), ".cache", "note-embeddings.json");

/**
 * The text actually fed to the embedding model for a run: name and
 * description combined, since both carry signal ("Hilly Trail Loop" is
 * itself a decent search target even with no description attached).
 * Returns undefined for a run with neither -- nothing to index.
 *
 * Pure function, no model involved, so this (and everything else in this
 * file except the two `embed*` calls) is fully unit-testable.
 */
export function noteText(run: Run): string | undefined {
  const parts = [run.name, run.description].filter((s): s is string => Boolean(s && s.trim().length > 0));
  if (parts.length === 0) return undefined;
  return parts.join(". ");
}

/** Short, stable cache key for a piece of text -- changes if the note's content changes. */
function hashText(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

type EmbeddingCache = Record<string, number[]>; // key: `${runId}:${hashText(text)}`

function loadCache(cachePath: string): EmbeddingCache {
  try {
    const raw = readFileSync(cachePath, "utf-8");
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? (parsed as EmbeddingCache) : {};
  } catch {
    // Missing file, first run, or a corrupted cache -- all the same
    // response: start fresh. This is a cache, not a source of truth, so
    // losing it costs re-embedding time, never correctness.
    return {};
  }
}

function saveCache(cachePath: string, cache: EmbeddingCache): void {
  try {
    mkdirSync(path.dirname(cachePath), { recursive: true });
    writeFileSync(cachePath, JSON.stringify(cache));
  } catch {
    // Best-effort. A failed write just means the next startup re-embeds
    // everything -- slower, not wrong -- so this never blocks server
    // startup over a disk permissions issue.
  }
}

export interface BuildNoteIndexOptions {
  cachePath?: string;
  /** Injectable for testing -- the default calls the real local embedding model. */
  embedBatchFn?: (texts: string[]) => Promise<number[][]>;
}

/**
 * Builds the searchable note index: one embedding per run that has a
 * name or description, computed once and cached to disk by content hash
 * so an unchanged note never gets re-embedded on a later startup -- only
 * genuinely new or edited notes hit the model. On a large real export
 * this is the difference between a multi-minute cold start every time
 * and a near-instant one after the first run.
 *
 * `embedBatchFn` defaults to the real local model (see embeddings.ts),
 * which this project's sandbox can't install or run -- but everything
 * else here (which runs need embedding vs. which are cached, how the
 * cache key is built, what happens on a cache hit or miss) is ordinary
 * logic that's fully testable with a fake embedder standing in for it.
 * See __tests__/noteIndex.test.ts.
 */
export async function buildNoteIndex(runs: Run[], options: BuildNoteIndexOptions = {}): Promise<EmbeddedNote[]> {
  const cachePath = options.cachePath ?? DEFAULT_CACHE_PATH;
  const embedBatchFn = options.embedBatchFn ?? realEmbedBatch;

  const candidates = runs
    .map((run) => ({ run, text: noteText(run) }))
    .filter((c): c is { run: Run; text: string } => c.text !== undefined);

  const cache = loadCache(cachePath);
  const notes: EmbeddedNote[] = [];
  const toEmbed: { run: Run; text: string; cacheKey: string }[] = [];

  for (const { run, text } of candidates) {
    const cacheKey = `${run.id}:${hashText(text)}`;
    const cached = cache[cacheKey];
    if (cached) {
      notes.push({ runId: run.id, text, embedding: cached });
    } else {
      toEmbed.push({ run, text, cacheKey });
    }
  }

  if (toEmbed.length > 0) {
    const embeddings = await embedBatchFn(toEmbed.map((c) => c.text));
    toEmbed.forEach((c, i) => {
      const embedding = embeddings[i]!;
      notes.push({ runId: c.run.id, text: c.text, embedding });
      cache[c.cacheKey] = embedding;
    });
    saveCache(cachePath, cache);
  }

  return notes;
}

export interface SearchNotesOptions extends RankOptions {
  /** Injectable for testing -- the default calls the real local embedding model. */
  embedTextFn?: (text: string) => Promise<number[]>;
}

/** Embeds the query and ranks the index against it. See rankByQuery.ts for the matching/threshold logic. */
export async function searchNotes(
  index: EmbeddedNote[],
  query: string,
  options: SearchNotesOptions = {}
): Promise<NoteMatch[]> {
  const embedTextFn = options.embedTextFn ?? realEmbedText;
  const queryEmbedding = await embedTextFn(query);
  return rankByQuery(index, queryEmbedding, options);
}
