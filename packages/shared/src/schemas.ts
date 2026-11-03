import { z } from 'zod';

/**
 * Zod schemas are the single source of truth for every type that crosses a boundary:
 * API requests and responses, MCP tool inputs, client-side forms. TypeScript types are
 * derived with z.infer rather than declared alongside, so a schema and its type can
 * never drift apart.
 */

// ---------------------------------------------------------------- constants

/**
 * Vector width, fixed by the embedding model (bge-small-en-v1.5) and baked into the
 * chunks.embedding column as vector(384). Changing it means a migration plus a full
 * re-index, so both sides read this one constant.
 */
export const EMBEDDING_DIMENSIONS = 384;

// ---------------------------------------------------------------- primitives

export const RoleSchema = z.enum(['user', 'admin']);
export type Role = z.infer<typeof RoleSchema>;

/** Derived from the corpus directory layout at ingestion; see the loader. */
export const DocTypeSchema = z.enum([
  'reference',
  'api-reference',
  'policy',
  'runbook',
  'release-note',
  'decision-record',
  'incident',
  'merchant-profile',
  'settlement-report',
]);
export type DocType = z.infer<typeof DocTypeSchema>;

/**
 * 'deprecated' is detected from document content at ingestion. It down-weights a
 * document in ranking but never excludes it — the correct answer to "how do I create a
 * payment?" has to be able to say that API v1 is retired.
 */
export const DocStatusSchema = z.enum(['current', 'deprecated']);
export type DocStatus = z.infer<typeof DocStatusSchema>;

export const SearchModeSchema = z.enum(['vector', 'hybrid']);
export type SearchMode = z.infer<typeof SearchModeSchema>;

// ---------------------------------------------------------------- search

export const SearchRequestSchema = z.object({
  query: z.string().min(1).max(500),
  topK: z.number().int().min(1).max(20).default(6),
  mode: SearchModeSchema.default('hybrid'),
  docType: DocTypeSchema.optional(),
  project: z.string().optional(),
});

/** Parsed shape, with defaults applied — what a handler works with. */
export type SearchRequest = z.infer<typeof SearchRequestSchema>;
/** Unparsed shape, defaults still optional — what a caller sends. */
export type SearchRequestInput = z.input<typeof SearchRequestSchema>;

export const RetrievedChunkSchema = z.object({
  chunkId: z.string(),
  documentId: z.string(),
  title: z.string(),
  sourcePath: z.string(),
  docType: DocTypeSchema,
  project: z.string().nullable(),
  period: z.string().nullable(),
  status: DocStatusSchema,
  /** The passage as written; the context prefix used for embedding is not shown. */
  content: z.string(),

  /** Fused RRF score, after the deprecated down-weight. Ranks results. */
  score: z.number(),
  /**
   * Raw cosine similarity from the vector arm, 0..1. This — not `score` — is what the
   * no-answer guard thresholds on: an RRF score is derived from rank, so its top value
   * is roughly constant whether or not the corpus can answer the question.
   *
   * Null when the chunk was found only by the keyword arm, so it has no vector distance.
   */
  cosine: z.number().nullable(),

  vectorRank: z.number().int().nullable(),
  keywordRank: z.number().int().nullable(),
});
export type RetrievedChunk = z.infer<typeof RetrievedChunkSchema>;

// ---------------------------------------------------------------- answers

export const CitationSchema = z.object({
  /** The [n] marker as it appears in the answer text, 1-based. */
  index: z.number().int().min(1),
  documentId: z.string(),
  title: z.string(),
  sourcePath: z.string(),
});
export type Citation = z.infer<typeof CitationSchema>;

/** 'extractive' is the no-API-key fallback: ranked passages, no written answer. */
export const AnswerModeSchema = z.enum(['generative', 'extractive']);
export type AnswerMode = z.infer<typeof AnswerModeSchema>;

export const AnswerSchema = z.object({
  answer: z.string(),
  /** Only citations that resolve to a genuinely retrieved passage survive validation. */
  citations: z.array(CitationSchema),
  grounded: z.boolean(),
  mode: AnswerModeSchema,
});
export type Answer = z.infer<typeof AnswerSchema>;

// ---------------------------------------------------------------- errors

/** Kept as a closed set so every route reports failures the same way. */
export const ApiErrorCodeSchema = z.enum([
  'UNAUTHENTICATED', // 401 — no valid session
  'FORBIDDEN', // 403 — signed in, wrong role
  'VALIDATION_ERROR', // 400 — failed Zod parse
  'NOT_FOUND', // 404
  'RATE_LIMITED', // 429
  'INTERNAL_ERROR', // 500
]);
export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;

export const ApiErrorSchema = z.object({
  error: z.object({
    code: ApiErrorCodeSchema,
    message: z.string(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
