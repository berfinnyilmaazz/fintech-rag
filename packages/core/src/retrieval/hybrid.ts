import { type Db, db as defaultDb } from '@rag/db';
import type { RetrievedChunk } from '@rag/shared';
import { sql } from 'drizzle-orm';
import { getEmbeddingProvider } from '../embeddings/index';
import { MMR_LAMBDA, MMR_POOL, selectMmr } from './mmr';
import { hasRecencyCue, promoteLatest } from './recency';
import { cosineFromDistance, HybridRowSchema, parseEmbedding, parseRows } from './rows';
import {
  CANDIDATE_POOL,
  DEFAULT_KEYWORD_MODE,
  DEFAULT_MMR,
  DEFAULT_RECENCY,
  DEFAULT_TOP_K,
  DEPRECATED_RANK_PENALTY,
  RRF_K,
  type SearchOptions,
  type SearchResult,
} from './types';

/**
 * Hybrid retrieval: pgvector cosine and tsvector BM25-style ranking, fused with Reciprocal
 * Rank Fusion in a single SQL round trip.
 *
 * RRF fuses *ranks*, not scores, so the two arms need no normalisation against each other
 * — which matters because a cosine similarity and a ts_rank are not on comparable scales
 * and never will be.
 *
 * Two shapes in this query are deliberate:
 *
 * 1. **The vector CTE nests.** `ROW_NUMBER()` runs over the already-limited 20 rows. A flat
 *    `ROW_NUMBER() OVER (ORDER BY embedding <=> $1)` alongside `LIMIT 20` would be
 *    evaluated before the limit, sorting every chunk in the table and leaving the HNSW
 *    index unused. Irrelevant at a hundred chunks, wrong at any real scale.
 *
 * 2. **`min_dist` is a scalar subquery over the whole vector CTE**, not the distance of the
 *    first fused row. See SearchResult.topCosine for why that distinction decides whether
 *    the no-answer guard works at all.
 */
export async function hybridSearch(options: SearchOptions): Promise<SearchResult> {
  const database: Db = options.db ?? defaultDb;
  const topK = options.topK ?? DEFAULT_TOP_K;
  const startedAt = performance.now();

  const queryVector =
    options.queryVector ??
    (await (options.embeddings ?? getEmbeddingProvider()).embedQuery(options.query));
  const embedMs = Math.round(performance.now() - startedAt);

  // Serialised and cast by hand: drizzle's mapToDriverValue runs only on the query-builder
  // path, and postgres.js would send a JS array as a Postgres array literal, {0.1,…},
  // rather than the [0.1,…] pgvector expects.
  const literal = JSON.stringify(queryVector);
  const queryStartedAt = performance.now();

  // Applied inside both arms so the filter narrows the candidate pool rather than trimming
  // the fused result — filtering afterwards would leave fewer than topK results from a pool
  // that was ranked against documents the caller excluded.
  const filters = sql`${
    options.docType ? sql` AND d.doc_type = ${options.docType}` : sql``
  }${options.project ? sql` AND d.project = ${options.project}` : sql``}`;

  const useMmr = options.mmr ?? DEFAULT_MMR;
  const useRecency = (options.recency ?? DEFAULT_RECENCY) && hasRecencyCue(options.query);
  // MMR and the recency tie-break need something to choose between, so the SQL returns a
  // pool and they narrow it. Otherwise the database returns exactly what was asked for.
  const fetchLimit = useMmr || useRecency ? Math.max(MMR_POOL, topK) : topK;

  // Embeddings are 384 floats a row; they are only shipped back when MMR will actually use
  // them, so the ordinary retrieval path stays as cheap as it was.
  const embeddingColumn = useMmr ? sql`, c.embedding::text AS embedding` : sql``;

  const keywordMode = options.keywordMode ?? DEFAULT_KEYWORD_MODE;
  const andQuery = sql`websearch_to_tsquery('english', ${options.query})`;

  // Let websearch_to_tsquery do the parsing, stemming and escaping, then swap its AND
  // operators for OR. Nothing unsanitised reaches tsquery this way, and phrase operators
  // (<->) survive because they contain no '&'.
  //
  // Negation is the exception and is left alone: `a & !b` OR-ed becomes `a | !b`, which
  // matches every document that simply lacks b — the opposite of what was asked.
  const orQuery = sql`CASE WHEN ${andQuery}::text LIKE '%!%'
           THEN ${andQuery}
           ELSE replace(${andQuery}::text, '&', '|')::tsquery
      END`;

  const tsquery =
    keywordMode === 'or'
      ? orQuery
      : keywordMode === 'fallback'
        ? // Widen only when narrowing found nothing, so a query that the AND form answers
          // well is never diluted. The EXISTS repeats the arm's own filters: if the sole
          // AND match is a deleted document, the keyword arm is still empty and should widen.
          sql`CASE WHEN EXISTS (
                     SELECT 1 FROM chunks c
                     JOIN documents d ON d.id = c.document_id
                     WHERE d.deleted_at IS NULL${filters} AND c.tsv @@ ${andQuery}
                   )
                   THEN ${andQuery} ELSE ${orQuery}
              END`
        : andQuery;

  const rows = await database.execute(sql`
    WITH q AS (SELECT ${tsquery} AS tsq),
    vec AS (
      SELECT id, dist, ROW_NUMBER() OVER (ORDER BY dist, path, chunk_index) AS rank
      FROM (
        SELECT c.id, d.source_path AS path, c.chunk_index,
               c.embedding <=> ${literal}::vector AS dist
        FROM chunks c
        JOIN documents d ON d.id = c.document_id
        WHERE d.deleted_at IS NULL${filters}
        ORDER BY c.embedding <=> ${literal}::vector
        LIMIT ${CANDIDATE_POOL}
      ) t
    ),
    kw AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY rk DESC, path, chunk_index) AS rank
      FROM (
        SELECT c.id, d.source_path AS path, c.chunk_index, ts_rank(c.tsv, q.tsq) AS rk
        FROM chunks c
        JOIN documents d ON d.id = c.document_id
        CROSS JOIN q
        WHERE d.deleted_at IS NULL${filters}
          AND c.tsv @@ q.tsq
        -- The tie-break is not decoration. ts_rank ties constantly on this corpus,
        -- because the settlement reports are built from a small pool of shared sentences
        -- and differ mostly in their header. Without it
        -- the LIMIT keeps an arbitrary 20 of them and ROW_NUMBER orders them arbitrarily,
        -- so identical searches return different results between runs.
        --
        -- It orders by source_path, not by c.id: chunk ids are generated at insert time, so
        -- an id tie-break is stable within one index but changes on every re-ingest. That
        -- made a fresh clone reproduce different eval numbers from the same corpus. The path
        -- is a property of the corpus, so the ranking is now reproducible from the corpus
        -- alone. Arbitrary but stable beats arbitrary and unstable; MMR is what actually
        -- discriminates between equals.
        ORDER BY rk DESC, d.source_path, c.chunk_index
        LIMIT ${CANDIDATE_POOL}
      ) t
    ),
    fused AS (
      SELECT COALESCE(vec.id, kw.id) AS id,
             vec.dist                AS dist,
             vec.rank                AS vector_rank,
             kw.rank                 AS keyword_rank
      FROM vec
      FULL OUTER JOIN kw ON kw.id = vec.id
    )
    SELECT c.id          AS chunk_id,
           c.document_id AS document_id,
           c.content     AS content,
           d.title       AS title,
           d.source_path AS source_path,
           d.doc_type    AS doc_type,
           d.project     AS project,
           d.period      AS period,
           d.status      AS status,
           f.dist        AS dist,
           f.vector_rank AS vector_rank,
           f.keyword_rank AS keyword_rank,
           ( COALESCE(1.0 / (${RRF_K} + f.vector_rank + p.penalty), 0)
           + COALESCE(1.0 / (${RRF_K} + f.keyword_rank + p.penalty), 0) ) AS score,
           (SELECT MIN(dist) FROM vec) AS min_dist${embeddingColumn}
    FROM fused f
    JOIN chunks c ON c.id = f.id
    JOIN documents d ON d.id = c.document_id
    CROSS JOIN LATERAL (
      SELECT CASE WHEN d.status = 'deprecated' THEN ${DEPRECATED_RANK_PENALTY} ELSE 0 END
    ) AS p(penalty)
    -- Distance breaks ties so ordering is deterministic; a rank offset can land a demoted
    -- document exactly on another candidate's score. The path is the final tie-break, for
    -- the case where both candidates came from the keyword arm alone and have no distance.
    ORDER BY score DESC, f.dist ASC NULLS LAST, d.source_path
    LIMIT ${fetchLimit}
  `);

  const fused = parseRows(HybridRowSchema, rows);
  const ranked = useRecency ? promoteLatest(fused) : fused;
  const parsed = useMmr
    ? selectMmr(
        ranked.map((row) => ({ ...row, embedding: parseEmbedding(row.embedding) })),
        topK,
        options.mmrLambda ?? MMR_LAMBDA,
      )
    : ranked.slice(0, topK);

  const chunks: RetrievedChunk[] = parsed.map((row) => ({
    chunkId: row.chunk_id,
    documentId: row.document_id,
    title: row.title,
    sourcePath: row.source_path,
    docType: row.doc_type,
    project: row.project,
    period: row.period,
    status: row.status,
    content: row.content,
    score: row.score,
    cosine: row.dist === null ? null : cosineFromDistance(row.dist),
    vectorRank: row.vector_rank,
    keywordRank: row.keyword_rank,
  }));

  const minDist = parsed[0]?.min_dist ?? null;

  return {
    chunks,
    topCosine: minDist === null ? null : cosineFromDistance(minDist),
    mode: 'hybrid',
    latencyMs: Math.round(performance.now() - startedAt),
    embedMs,
    queryMs: Math.round(performance.now() - queryStartedAt),
  };
}
