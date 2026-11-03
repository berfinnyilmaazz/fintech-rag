import { z } from 'zod';
import {
  AnswerModeSchema,
  CitationSchema,
  DocStatusSchema,
  DocTypeSchema,
  RetrievedChunkSchema,
  SearchModeSchema,
} from './schemas';

/**
 * Request and response contracts for the HTTP surface. The routes validate against these
 * and the frontend imports the same types, so a response shape cannot drift from what the
 * page expects without a type error.
 *
 * Timestamps are ISO strings rather than Date: these cross a JSON boundary, and typing them
 * as Date would be a lie the client has to cast its way out of.
 */

// ---------------------------------------------------------------- search

export const SearchResponseSchema = z.object({
  query: z.string(),
  mode: SearchModeSchema,
  chunks: z.array(RetrievedChunkSchema),
  topCosine: z.number().nullable(),
  latencyMs: z.number().int(),
});
export type SearchResponse = z.infer<typeof SearchResponseSchema>;

// ---------------------------------------------------------------- chat

export const ChatRequestSchema = z.object({
  query: z.string().min(1).max(500),
  topK: z.number().int().min(1).max(20).default(6),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type ChatRequestInput = z.input<typeof ChatRequestSchema>;

/**
 * Newline-delimited JSON events. Tokens stream as they arrive; `done` carries the
 * *validated* citation list, which cannot exist before the answer is complete — that is the
 * whole reason the stream is not handed through untouched.
 */
export const ChatEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('token'), value: z.string() }),
  z.object({
    type: z.literal('done'),
    answer: z.string(),
    citations: z.array(CitationSchema),
    grounded: z.boolean(),
    mode: AnswerModeSchema,
    topCosine: z.number().nullable(),
    passages: z.array(RetrievedChunkSchema),
    latencyMs: z.number().int(),
    retrievalMs: z.number().int(),
    /** The no-answer cosine threshold, sent so the client can show it without importing core. */
    threshold: z.number(),
  }),
  z.object({ type: z.literal('error'), code: z.string(), message: z.string() }),
]);
export type ChatEvent = z.infer<typeof ChatEventSchema>;

// ---------------------------------------------------------------- documents

export const DocumentSummarySchema = z.object({
  id: z.string(),
  sourcePath: z.string(),
  title: z.string(),
  docType: DocTypeSchema,
  project: z.string().nullable(),
  period: z.string().nullable(),
  status: DocStatusSchema,
  tokenCount: z.number().int(),
  chunkCount: z.number().int(),
  byteSize: z.number().int(),
  embeddingModel: z.string(),
  indexedAt: z.string(),
  deletedAt: z.string().nullable(),
});
export type DocumentSummary = z.infer<typeof DocumentSummarySchema>;

export const DocumentQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
  docType: DocTypeSchema.optional(),
  project: z.string().min(1).max(100).optional(),
  status: DocStatusSchema.optional(),
  /** Include soft-deleted documents. Off by default so the list matches what is searchable. */
  includeDeleted: z
    .union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')])
    .default(false),
});
export type DocumentQuery = z.infer<typeof DocumentQuerySchema>;
export type DocumentQueryInput = z.input<typeof DocumentQuerySchema>;

export const DocumentListResponseSchema = z.object({
  documents: z.array(DocumentSummarySchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});
export type DocumentListResponse = z.infer<typeof DocumentListResponseSchema>;

export const DeleteDocumentResponseSchema = z.object({
  id: z.string(),
  sourcePath: z.string(),
  chunksRemoved: z.number().int(),
});
export type DeleteDocumentResponse = z.infer<typeof DeleteDocumentResponseSchema>;

// ---------------------------------------------------------------- ingestion

export const IngestTriggerSchema = z.object({
  corpusPath: z.string().min(1).optional(),
});
export type IngestTrigger = z.infer<typeof IngestTriggerSchema>;

/** 202 Accepted: the run is registered and the work continues in the background. */
export const IngestAcceptedResponseSchema = z.object({
  runId: z.string(),
  status: z.literal('running'),
});
export type IngestAcceptedResponse = z.infer<typeof IngestAcceptedResponseSchema>;

export const IngestionRunSummarySchema = z.object({
  id: z.string(),
  trigger: z.enum(['cli', 'dashboard', 'watcher']),
  status: z.enum(['running', 'completed', 'failed']),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  docsAdded: z.number().int(),
  docsUpdated: z.number().int(),
  docsSkipped: z.number().int(),
  docsDeleted: z.number().int(),
  chunksWritten: z.number().int(),
  errorMessage: z.string().nullable(),
});
export type IngestionRunSummary = z.infer<typeof IngestionRunSummarySchema>;

export const IngestionRunsResponseSchema = z.object({
  runs: z.array(IngestionRunSummarySchema),
});
export type IngestionRunsResponse = z.infer<typeof IngestionRunsResponseSchema>;

// ---------------------------------------------------------------- stats

export const StatsResponseSchema = z.object({
  corpus: z.object({
    documents: z.number().int(),
    deletedDocuments: z.number().int(),
    chunks: z.number().int(),
    tokens: z.number().int(),
    deprecated: z.number().int(),
    byDocType: z.array(z.object({ docType: DocTypeSchema, count: z.number().int() })),
    lastIndexedAt: z.string().nullable(),
  }),
  search: z.object({
    totalQueries: z.number().int(),
    /** Share of answers that were grounded in retrieved sources. */
    groundedRate: z.number().nullable(),
    /** Share that came back as "the corpus does not cover this". */
    refusalRate: z.number().nullable(),
    avgLatencyMs: z.number().nullable(),
    avgTopCosine: z.number().nullable(),
    topQueries: z.array(z.object({ query: z.string(), count: z.number().int() })),
  }),
  lastRun: IngestionRunSummarySchema.nullable(),
});
export type StatsResponse = z.infer<typeof StatsResponseSchema>;
