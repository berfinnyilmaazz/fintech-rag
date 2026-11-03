import type { AnswerMode, RetrievedChunk } from '@rag/shared';

export interface AnswerRequest {
  question: string;
  /** Numbered from 1 in this order; citation [n] refers to passages[n - 1]. */
  passages: RetrievedChunk[];
}

export interface LlmStream {
  textStream: AsyncIterable<string>;
  /** Resolves once the stream completes. Citation validation runs on this. */
  text: Promise<string>;
}

/**
 * The seam between orchestration and whatever produces the prose. Both implementations
 * satisfy it — the extractive one produces text without a model at all, so a missing API
 * key degrades the answer rather than breaking the request.
 */
export interface LlmProvider {
  readonly id: string;
  readonly mode: AnswerMode;
  stream(request: AnswerRequest): LlmStream;
}

/**
 * The exact sentence the system prompt asks for and the guard emits. Kept in one place so
 * the two cannot drift; the eval matches on it.
 */
export const NO_ANSWER_TEXT = 'The corpus does not cover this.';

/**
 * Below this cosine similarity the question is treated as outside the corpus and no model
 * is called.
 *
 * **Calibrated, not chosen.** `scripts/calibrate-threshold.ts` measures `topCosine` for
 * answerable, out-of-corpus and unrelated questions; the threshold sits in the gap between
 * "unrelated" and "answerable". The measured ranges are in EVAL_RESULTS.md.
 *
 * **What this threshold does not do:** it cannot reliably catch out-of-corpus questions
 * phrased in domain vocabulary, which can score above questions the corpus genuinely
 * answers. Raising the threshold to catch them would refuse real questions instead. Those are
 * refused by the model, under instruction, with every citation validated afterwards.
 */
export const NO_ANSWER_COSINE_THRESHOLD = 0.53;
