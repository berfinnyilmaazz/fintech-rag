import { type Db, db as defaultDb } from '@rag/db';
import type { StatsResponse } from '@rag/shared';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { listIngestionRuns } from './documents';

/**
 * Dashboard analytics. Written as raw SQL because these are aggregate reads over five
 * tables and the query builder would make them harder to read, not easier — and rows are
 * parsed rather than asserted, same discipline as retrieval.
 */

const numeric = z.union([
  z.number(),
  z.string().transform((value) => Number(value)),
  z.null().transform(() => 0),
]);

const CorpusRowSchema = z.object({
  documents: numeric,
  deleted_documents: numeric,
  deprecated: numeric,
  chunks: numeric,
  tokens: numeric,
  last_indexed_at: z.union([z.date(), z.string(), z.null()]),
});

const DocTypeRowSchema = z.object({ doc_type: z.string(), count: numeric });

const SearchRowSchema = z.object({
  total_queries: numeric,
  grounded: numeric,
  refusals: numeric,
  avg_latency: z.union([z.number(), z.string(), z.null()]),
  avg_top_cosine: z.union([z.number(), z.string(), z.null()]),
});

const TopQueryRowSchema = z.object({ query: z.string(), count: numeric });

const toNumber = (value: number | string | null): number | null =>
  value === null ? null : Number(value);

const toIso = (value: Date | string | null): string | null =>
  value === null ? null : value instanceof Date ? value.toISOString() : value;

export async function getStats(database: Db = defaultDb): Promise<StatsResponse> {
  const [corpusRows, docTypeRows, searchRows, topQueryRows, runs] = await Promise.all([
    database.execute(sql`
      SELECT
        (SELECT count(*) FROM documents WHERE deleted_at IS NULL)                     AS documents,
        (SELECT count(*) FROM documents WHERE deleted_at IS NOT NULL)                 AS deleted_documents,
        (SELECT count(*) FROM documents WHERE deleted_at IS NULL
                                          AND status = 'deprecated')                  AS deprecated,
        (SELECT count(*) FROM chunks)                                                 AS chunks,
        (SELECT COALESCE(sum(token_count), 0) FROM documents WHERE deleted_at IS NULL) AS tokens,
        (SELECT max(indexed_at) FROM documents WHERE deleted_at IS NULL)              AS last_indexed_at
    `),
    database.execute(sql`
      SELECT doc_type, count(*) AS count
      FROM documents WHERE deleted_at IS NULL
      GROUP BY doc_type ORDER BY count DESC
    `),
    database.execute(sql`
      SELECT count(*)                                             AS total_queries,
             count(*) FILTER (WHERE grounded)                     AS grounded,
             -- A refusal retrieves nothing, so result_count is the signal.
             count(*) FILTER (WHERE result_count = 0)             AS refusals,
             avg(latency_ms)                                      AS avg_latency,
             avg(top_cosine)                                      AS avg_top_cosine
      FROM search_logs
    `),
    database.execute(sql`
      SELECT query, count(*) AS count
      FROM search_logs
      GROUP BY query ORDER BY count DESC, query ASC LIMIT 10
    `),
    listIngestionRuns(1, database),
  ]);

  const corpus = CorpusRowSchema.parse([...corpusRows][0]);
  const search = SearchRowSchema.parse([...searchRows][0]);
  const totalQueries = Number(search.total_queries);

  return {
    corpus: {
      documents: Number(corpus.documents),
      deletedDocuments: Number(corpus.deleted_documents),
      chunks: Number(corpus.chunks),
      tokens: Number(corpus.tokens),
      deprecated: Number(corpus.deprecated),
      byDocType: [...docTypeRows].map((row) => {
        const parsed = DocTypeRowSchema.parse(row);
        return {
          docType: parsed.doc_type as StatsResponse['corpus']['byDocType'][number]['docType'],
          count: Number(parsed.count),
        };
      }),
      lastIndexedAt: toIso(corpus.last_indexed_at),
    },
    search: {
      totalQueries,
      // Null rather than 0 when nothing has been asked yet: "0% grounded" would read as a
      // failure, and an empty log is not a failure.
      groundedRate: totalQueries === 0 ? null : Number(search.grounded) / totalQueries,
      refusalRate: totalQueries === 0 ? null : Number(search.refusals) / totalQueries,
      avgLatencyMs: toNumber(search.avg_latency),
      avgTopCosine: toNumber(search.avg_top_cosine),
      topQueries: [...topQueryRows].map((row) => {
        const parsed = TopQueryRowSchema.parse(row);
        return { query: parsed.query, count: Number(parsed.count) };
      }),
    },
    lastRun: runs[0] ?? null,
  };
}
