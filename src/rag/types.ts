/**
 * Shared types for semantic search over run notes. Kept separate from
 * `src/data/types.ts` and `src/analysis/types.ts` because this is a
 * different kind of data entirely -- everything in those two layers is
 * exact, computed, and deterministic; everything here is approximate by
 * design (a similarity score, not an equality check).
 */

/** A run's free text, embedded once and ready to be compared against a query. */
export interface EmbeddedNote {
  runId: string;
  /** The exact text that was embedded -- name + description, see noteIndex.ts. */
  text: string;
  /** A fixed-length vector from the embedding model (384 dims for the model this project uses). */
  embedding: number[];
}

/** One search result: a run whose note was semantically close to the query. */
export interface NoteMatch {
  runId: string;
  text: string;
  /** Cosine similarity to the query, in [-1, 1] in theory, effectively [0, 1] in practice for this model. */
  score: number;
}
