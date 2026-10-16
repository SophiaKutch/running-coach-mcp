/**
 * Cosine similarity between two equal-length vectors: the cosine of the
 * angle between them, in [-1, 1]. For sentence embeddings specifically,
 * this is the standard distance metric -- it compares *direction*, not
 * magnitude, which matters because embedding magnitude mostly reflects
 * text length/confidence rather than meaning.
 *
 * Pure arithmetic, zero dependency on any embedding model, and exactly
 * where this project's "pure functions are exhaustively testable"
 * principle (see src/analysis) extends into the RAG layer: nothing about
 * ranking or comparing vectors needs the model itself to be loaded.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`cosineSimilarity: vector length mismatch (${a.length} vs ${b.length})`);
  }
  if (a.length === 0) return 0;

  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    magA += a[i]! * a[i]!;
    magB += b[i]! * b[i]!;
  }

  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}
