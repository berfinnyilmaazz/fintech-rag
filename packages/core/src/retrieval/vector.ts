import { type Db, db as defaultDb } from '@rag/db';
import type { RetrievedChunk } from '@rag/shared';
import { sql } from 'drizzle-orm';
import { getEmbeddingProvider } from '../embeddings/index';
import { cosineFromDistance, parseRows, VectorRowSchema } from './rows';
import { DEFAULT_TOP_K, type SearchOptions, type SearchResult } from './types';

/**
 * Vector-only retrieval — the baseline hybrid is measured against, and the `mode: 'vector'`
 * the eval runs to produce the before/after table.
 *
 * Built on a raw `sql` template rather than the query builder so both retrieval paths share
 * the same serialisation rules. The query vector is stringified and cast explicitly:
 * drizzle's `mapToDriverValue` runs only on the query-builder path, and postgres.js would
 * otherwise serialise a JS array as a Postgres array literal, `{0.1,…}`, not the `[0.1,…]`
 * pgvector expects.
 */
export async function vectorSearch(options: SearchOptions): Promise<SearchResult> {
  const database: Db = options.db ?? defaultDb;
  const topK = options.topK ?? DEFAULT_TOP_K;
  const startedAt = performance.now();

  const queryVector =
    options.queryVector ??
    (await (options.embeddings ?? getEmbeddingProvider()).embedQuery(options.query));
  const embedMs = Math.round(performance.now() - startedAt);
  const literal = JSON.stringify(queryVector);
  const queryStartedAt = performance.now();

  const filters = sql`${
    options.docType ? sql` AND d.doc_type = ${options.docType}` : sql``
  }${options.project ? sql` AND d.project = ${options.project}` : sql``}`;

  const rows = await database.execute(sql`
    SELECT c.id            AS chunk_id,
           c.document_id   AS document_id,
           c.content       AS content,
           d.title         AS title,
           d.source_path   AS source_path,
           d.doc_type      AS doc_type,
           d.project       AS project,
           d.period        AS period,
           d.status        AS status,
           c.embedding <=> ${literal}::vector AS dist
    FROM chunks c
    JOIN documents d ON d.id = c.document_id
    WHERE d.deleted_at IS NULL${filters}
    ORDER BY c.embedding <=> ${literal}::vector
    LIMIT ${topK}
  `);

  const chunks: RetrievedChunk[] = parseRows(VectorRowSchema, rows).map((row, index) => {
    const cosine = cosineFromDistance(row.dist);
    return {
      chunkId: row.chunk_id,
      documentId: row.document_id,
      title: row.title,
      sourcePath: row.source_path,
      docType: row.doc_type,
      project: row.project,
      period: row.period,
      status: row.status,
      content: row.content,
      // Vector-only ranks by similarity, so the score is the similarity. Hybrid replaces
      // this with the fused RRF value while `cosine` keeps meaning the same thing.
      score: cosine,
      cosine,
      vectorRank: index + 1,
      keywordRank: null,
    };
  });

  return {
    chunks,
    // Vector-only orders by distance, so the first row is the closest by construction.
    topCosine: chunks[0]?.cosine ?? null,
    mode: 'vector',
    latencyMs: Math.round(performance.now() - startedAt),
    embedMs,
    queryMs: Math.round(performance.now() - queryStartedAt),
  };
}

export { DEFAULT_TOP_K };
