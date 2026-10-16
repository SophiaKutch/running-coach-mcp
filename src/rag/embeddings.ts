import type { FeatureExtractionPipeline } from "@huggingface/transformers";

/**
 * Local sentence-embedding model. `Xenova/all-MiniLM-L6-v2` is a small
 * (~90MB quantized), well-known general-purpose embedding model with a
 * long track record specifically as an ONNX export for transformers.js --
 * good enough for semantic search over a few hundred short run notes,
 * and small enough to download and run on a laptop with no GPU.
 *
 * This runs entirely locally, via `@huggingface/transformers` (the
 * official successor to the community `@xenova/transformers` package --
 * same underlying ONNX runtime, same model repo namespace). No API key,
 * no per-call cost, no network needed after the model's first download.
 * That's a deliberate trade-off against calling a hosted embeddings API:
 * slower to embed, and a real dependency with a model download on first
 * run, in exchange for keeping this project's "clone it and run it, no
 * account needed" property intact -- the same property `data/sample` was
 * built around in Phase 1.
 */
export const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";
export const EMBEDDING_DIMENSIONS = 384;

/**
 * This file could not be run or tested in the sandbox this project was
 * built in: no access to the npm registry (to install
 * @huggingface/transformers) or to huggingface.co (to download the model
 * weights on first use). It's written carefully against the current
 * package's documented API -- `pipeline("feature-extraction", ...)`
 * called with `{ pooling: "mean", normalize: true }`, reading the result
 * Tensor's `.data` -- but it is genuinely unverified until you run it
 * locally, where both of those network paths are open. See README.md.
 */

let extractorPromise: Promise<FeatureExtractionPipeline> | undefined;

/**
 * Loads the embedding model once and reuses it for every subsequent call
 * -- loading it is the expensive part (model download on first run, then
 * parsing the ONNX graph into memory on every run after that), so this
 * module-level cache matters: without it, every tool call would reload
 * the whole model from scratch.
 */
async function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      const { pipeline } = await import("@huggingface/transformers");
      return pipeline("feature-extraction", EMBEDDING_MODEL);
    })();
  }
  return extractorPromise;
}

/** Embeds a single piece of text into a 384-dimensional vector. */
export async function embedText(text: string): Promise<number[]> {
  const extractor = await getExtractor();
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}

/**
 * Embeds many texts in one batched call -- meaningfully faster than
 * calling `embedText` in a loop, since the model does its own batching
 * internally. Used once, at startup, to build the note index; see
 * noteIndex.ts.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const extractor = await getExtractor();
  const output = await extractor(texts, { pooling: "mean", normalize: true });
  // dims are [texts.length, EMBEDDING_DIMENSIONS]; tolist() gives us that
  // shape directly as nested arrays, which is simpler to slice per-text
  // than manually chunking the flat .data array ourselves.
  return output.tolist() as number[][];
}
