import { DocStatusSchema, DocTypeSchema } from '@rag/shared';
import { z } from 'zod';

/**
 * Raw SQL returns `Record<string, unknown>`, so rows are parsed rather than asserted.
 *
 * The coercion matters: postgres.js hands back `numeric` and `bigint` columns as strings
 * to avoid precision loss, so the RRF score and the ROW_NUMBER ranks arrive as text even
 * though they are numbers.
 */
const numeric = z.union([
  z.number(),
  z.string().transform((value, ctx) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      ctx.addIssue({ code: 'custom', message: `expected a number, got "${value}"` });
      return z.NEVER;
    }
    return parsed;
  }),
]);

const DocumentColumns = {
  chunk_id: z.string(),
  document_id: z.string(),
  content: z.string(),
  title: z.string(),
  source_path: z.string(),
  doc_type: DocTypeSchema,
  project: z.string().nullable(),
  period: z.string().nullable(),
  status: DocStatusSchema,
};

export const VectorRowSchema = z.object({
  ...DocumentColumns,
  dist: numeric,
});

export const HybridRowSchema = z.object({
  ...DocumentColumns,
  /** Null when only the keyword arm found this chunk — it has no row in the vector CTE. */
  dist: numeric.nullable(),
  vector_rank: numeric.nullable(),
  keyword_rank: numeric.nullable(),
  score: numeric,
  /** Best distance across the whole vector CTE, identical on every row. */
  min_dist: numeric.nullable(),
  /** Only selected when MMR will use it; absent on the ordinary retrieval path. */
  embedding: z.string().nullish(),
});

export type VectorRow = z.infer<typeof VectorRowSchema>;
export type HybridRow = z.infer<typeof HybridRowSchema>;

export function parseRows<T>(
  schema: { parse: (value: unknown) => T },
  rows: Iterable<unknown>,
): T[] {
  return [...rows].map((row) => schema.parse(row));
}

const VectorLiteralSchema = z.array(z.number());

/**
 * pgvector prints a vector as `[0.1,0.2,…]`, which happens to be valid JSON — but it is a
 * Postgres text representation, not a promise of one, so the parse is validated rather than
 * asserted.
 */
export function parseEmbedding(literal: string | null | undefined): number[] {
  if (!literal) return [];
  try {
    return VectorLiteralSchema.parse(JSON.parse(literal));
  } catch {
    throw new Error(
      `Could not read an embedding back from the database: "${literal.slice(0, 40)}…"`,
    );
  }
}

/**
 * pgvector's `<=>` is cosine *distance* in [0, 2]. Similarity is 1 - distance, which is
 * what the no-answer guard thresholds on and what the dashboard stores.
 */
export function cosineFromDistance(distance: number): number {
  return 1 - distance;
}
