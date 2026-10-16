import { cosineSimilarity } from "./cosineSimilarity.js";
import type { EmbeddedNote, NoteMatch } from "./types.js";

/** Below this cosine similarity, a result is noise rather than a match -- see note on minScore below. */
export const DEFAULT_MIN_SCORE = 0.3;

export interface RankOptions {
  limit?: number;
  /**
   * Minimum cosine similarity to be considered a real match. Without a
   * floor, a nearest-neighbor search always returns *something*, even
   * for a query that has nothing to do with any note on file -- the
   * "least dissimilar" result still gets returned, which looks like a
   * match and isn't. This is the same "honest about what the data can't
   * support" discipline the analysis layer applies elsewhere in this
   * project, just applied to similarity scores instead of HR zones.
   */
  minScore?: number;
}

/**
 * Ranks embedded notes by similarity to a query embedding, highest first,
 * dropping anything under `minScore`. Pure function -- no model, no I/O --
 * so it's fully unit-testable with hand-built fake embeddings, independent
 * of whether the real embedding model is available.
 */
export function rankByQuery(
  notes: EmbeddedNote[],
  queryEmbedding: number[],
  options: RankOptions = {}
): NoteMatch[] {
  const limit = options.limit ?? 5;
  const minScore = options.minScore ?? DEFAULT_MIN_SCORE;

  const scored: NoteMatch[] = notes.map((note) => ({
    runId: note.runId,
    text: note.text,
    score: cosineSimilarity(note.embedding, queryEmbedding),
  }));

  return scored
    .filter((m) => m.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
