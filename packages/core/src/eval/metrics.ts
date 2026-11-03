import { z } from 'zod';

export const GoldenQuestionSchema = z.object({
  id: z.string(),
  group: z.enum(['sample', 'derived', 'refusal']),
  question: z.string(),
  /** Documents recall and MRR are scored against. Empty for refusal questions. */
  expected: z.array(z.string()),
  /** Useful context a good answer also draws on. Reported separately, never scored. */
  supporting: z.array(z.string()),
  shouldRefuse: z.boolean().default(false),
  note: z.string().optional(),
});

export const GoldenSetSchema = z.object({
  $comment: z.array(z.string()).optional(),
  questions: z.array(GoldenQuestionSchema).min(1),
});

export type GoldenQuestion = z.infer<typeof GoldenQuestionSchema>;
export type GoldenSet = z.infer<typeof GoldenSetSchema>;

/** One retrieval configuration under test. */
export interface EvalVariant {
  id: string;
  label: string;
}

/** What one question produced under one variant. */
export interface Measurement {
  ranking: string[];
  topCosine: number | null;
  latencyMs: number;
}

/** Question id → measurement, for a single variant. */
export type MeasuredSet = ReadonlyMap<string, Measurement>;

/**
 * Retrieval returns chunks, but the golden set names documents, so the ranking is collapsed
 * to first-occurrence document order before anything is scored.
 *
 * On this corpus one document is one chunk and the collapse is a no-op — but the chunker
 * splits anything over 512 tokens, and the day it does, two chunks of the same file must
 * not occupy two rank positions.
 */
export function toDocumentRanking(sourcePaths: string[]): string[] {
  return [...new Set(sourcePaths)];
}

/** Fraction of the expected documents that appear in the top k. */
export function recallAt(ranking: string[], expected: string[], k: number): number {
  if (expected.length === 0) return 1;
  const top = new Set(ranking.slice(0, k));
  const found = expected.filter((path) => top.has(path)).length;
  return found / expected.length;
}

/**
 * Reciprocal rank of the *first* expected document, 0 if none is in the top k. Averaged
 * across questions this is MRR@k.
 */
export function reciprocalRank(ranking: string[], expected: string[], k: number): number {
  if (expected.length === 0) return 0;
  const top = ranking.slice(0, k);
  const position = top.findIndex((path) => expected.includes(path));
  return position === -1 ? 0 : 1 / (position + 1);
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

/**
 * Latency is reported as a median rather than a mean. A single stalled query — a Docker
 * hiccup, a GC pause — moved the mean by 40% between two runs that produced byte-identical
 * rankings, which made the column look like a variant difference when it was noise.
 */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] ?? 0;
  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}
