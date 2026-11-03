import { getEncoding, type Tiktoken } from 'js-tiktoken';

/**
 * Token counting for chunk sizing.
 *
 * A caveat worth stating: this is cl100k_base (GPT), while the embedding model is
 * bge-small-en-v1.5, which uses BERT WordPiece. The counts are not identical. They are
 * used to decide *whether and where to split*, not to predict the embedder's truncation
 * exactly, and cl100k runs slightly coarser than WordPiece on English prose, so the 512
 * threshold errs on the safe side. On this corpus the difference is academic — the largest
 * document is around 220 tokens by either count — but it matters if the chunker ever fires.
 */

let encoder: Tiktoken | null = null;

function encoding(): Tiktoken {
  encoder ??= getEncoding('cl100k_base');
  return encoder;
}

export function countTokens(text: string): number {
  return encoding().encode(text).length;
}

export function encodeTokens(text: string): number[] {
  return encoding().encode(text);
}

export function decodeTokens(tokens: number[]): string {
  return encoding().decode(tokens);
}
