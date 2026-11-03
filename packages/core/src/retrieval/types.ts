import type { Db } from '@rag/db';
import type { DocType, RetrievedChunk, SearchMode } from '@rag/shared';
import type { EmbeddingProvider } from '../embeddings/index';

export interface SearchOptions {
  query: string;
  topK?: number;
  db?: Db;
  embeddings?: EmbeddingProvider;
  /**
   * Narrow the candidate pool before ranking. Both filters were already declared in
   * SearchRequestSchema and accepted by /api/search, but were silently ignored — a schema
   * that advertises a filter which does nothing is worse than no filter.
   */
  docType?: DocType;
  project?: string;
  /**
   * Overrides the query vector instead of embedding `query`. Used by measurement scripts
   * that compare two ways of embedding the same question.
   */
  queryVector?: number[];
  /**
   * How the keyword arm builds its tsquery. See KeywordMode.
   *
   * A variant knob rather than a caller-facing option: it exists so the eval can measure
   * the two against the golden set instead of the choice being argued about. It is not part
   * of SearchRequestSchema and no HTTP or MCP surface exposes it.
   */
  keywordMode?: KeywordMode;
  /** Diversify the fused candidates before returning topK. See mmr.ts. */
  mmr?: boolean;
  mmrLambda?: number;
  /** Promote the newest dated document on "latest" questions. See recency.ts. */
  recency?: boolean;
}

/**
 * How the keyword arm turns a question into a tsquery.
 *
 * `websearch_to_tsquery` ANDs its terms, so a long natural-language question only matches a
 * chunk containing *every* stemmed word — on this corpus the keyword arm frequently returns
 * nothing at all and hybrid silently degrades to vector-only.
 *
 * - `and`      — websearch_to_tsquery unchanged. Precise; often silent.
 * - `or`       — the parsed query's `&` operators rewritten to `|`. Always fires; noisier.
 * - `fallback` — `and`, but `or` when `and` matches nothing at all.
 */
export type KeywordMode = 'and' | 'or' | 'fallback';

export interface SearchResult {
  chunks: RetrievedChunk[];
  /**
   * Best cosine similarity anywhere in the vector candidate pool — **not** the cosine of
   * the first fused result. The guard's question is "is any document in the corpus
   * semantically close to this query?", so it takes the best of the whole pool regardless
   * of how fusion later reorders things. A keyword-only chunk can legitimately sort first
   * and carry a null cosine; reading `chunks[0].cosine` would misfire there.
   *
   * Null only when the corpus is empty.
   */
  topCosine: number | null;
  mode: SearchMode;
  latencyMs: number;
  /** Embedding the question dominates; the SQL is the cheap half. */
  embedMs: number;
  queryMs: number;
}

export const DEFAULT_TOP_K = 6;

/**
 * What the application actually retrieves with. Every alternative was measured against the
 * golden set rather than argued about; the tables are in EVAL_RESULTS.md.
 *
 * `and` is the default because it measured best. `fallback` was the default on an earlier
 * corpus, where it removed a failure mode at no cost; on this one, when AND matches nothing
 * the OR arm it widens to is noisier than having no keyword arm at all, and it costs recall@1.
 * The trade-off is accepted: a long question whose terms never co-occur gets vector-only
 * retrieval, which is what the measurements say is the better outcome here.
 *
 * MMR is kept only while it costs nothing at rank 1 and lowers the mean pairwise similarity
 * of the results on the repetitive settlement-report queries it was written for. The combination
 * shipped here is the one that was measured, not two separately-measured options stacked.
 */
export const DEFAULT_KEYWORD_MODE: KeywordMode = 'and';
export const DEFAULT_MMR = true;
export const DEFAULT_RECENCY = true;

/** How many candidates each arm contributes before fusion. */
export const CANDIDATE_POOL = 20;

/**
 * RRF's smoothing constant. 60 is the value from the original paper and the de facto
 * default; it flattens the difference between adjacent top ranks so neither arm can
 * dominate on rank 1 alone.
 */
export const RRF_K = 60;

/**
 * Deprecated documents are demoted by this many ranks in each arm — they are never filtered
 * out, because the correct answer to "how do I create a payment?" has to be able to say
 * that v1 is retired, which it cannot do if v1 was never retrieved.
 *
 * **The penalty is expressed in ranks, not as a score multiplier, and that is not a style
 * choice.** An RRF score is `1/(k + rank)`, so across a 20-candidate pool its entire range
 * is 1/61 to 1/80 — a spread of 1.31×. The originally specified ×0.6 multiplier is a 1.67×
 * penalty: larger than the whole range, so a deprecated document at rank 1 falls below
 * every candidate in the pool. That is a filter wearing a down-weight's clothing, and it
 * defeats the requirement it was written to satisfy.
 *
 * A rank offset is on the scale RRF actually works in: "treat this document as though it
 * had placed five positions lower". It also survives a change to CANDIDATE_POOL, which a
 * tuned multiplier would not.
 */
export const DEPRECATED_RANK_PENALTY = 5;
