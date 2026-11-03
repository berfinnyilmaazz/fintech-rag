import { EMBEDDING_DIMENSIONS } from '@rag/shared';
import { LocalEmbeddings } from './local';
import type { EmbeddingProvider } from './types';

export { LocalEmbeddings, type LocalEmbeddingsOptions, QUERY_PREFIX } from './local';
export type { EmbeddingProvider } from './types';

/**
 * Memoised, and that is not an optimisation — it is the difference between a working search
 * endpoint and an unusable one.
 *
 * `LocalEmbeddings` caches its Transformers.js pipeline on the *instance*, so handing back a
 * new instance per call meant every query re-initialised the model from the disk cache.
 * Measured over five consecutive queries: **20 ms on a reused provider against 3.4–7.7 s on
 * a fresh one**, roughly 200×. Every search, chat turn, MCP call and eval question paid it.
 *
 * The cache key is the resolved configuration rather than a bare boolean, so changing
 * EMBEDDING_MODEL between calls still builds the right provider instead of silently serving
 * the previous model's vectors.
 */
let cached: { key: string; provider: EmbeddingProvider } | null = null;

/**
 * Resolves the provider from EMBEDDING_PROVIDER. An unrecognised value throws rather than
 * falling back to the default: silently embedding with a different model than the operator
 * asked for produces an index that looks fine and retrieves badly.
 */
export function getEmbeddingProvider(): EmbeddingProvider {
  const provider = process.env.EMBEDDING_PROVIDER ?? 'local';
  const model = process.env.EMBEDDING_MODEL ?? '';
  const dimensions = process.env.EMBEDDING_DIMENSIONS ?? '';
  const key = `${provider}|${model}|${dimensions}`;

  if (cached !== null && cached.key === key) return cached.provider;

  switch (provider) {
    case 'local': {
      const instance = new LocalEmbeddings({
        model: process.env.EMBEDDING_MODEL,
        dimensions: parseDimensions(dimensions),
      });
      cached = { key, provider: instance };
      return instance;
    }
    default:
      throw new Error(`Unknown EMBEDDING_PROVIDER "${provider}". Supported values: local.`);
  }
}

function parseDimensions(raw: string | undefined): number | undefined {
  if (raw === undefined || raw.trim() === '') return undefined;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`EMBEDDING_DIMENSIONS must be a positive integer, got "${raw}".`);
  }
  return parsed;
}

/**
 * Fails before any embedding work starts if the provider's width does not match the
 * vector(384) column. Without this the mismatch surfaces as an opaque Postgres error
 * partway through indexing, after the model has already been downloaded and run.
 */
export function assertEmbeddingDimensions(provider: EmbeddingProvider): void {
  if (provider.dimensions !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Embedding model "${provider.id}" produces ${provider.dimensions}-dimensional vectors, ` +
        `but chunks.embedding is vector(${EMBEDDING_DIMENSIONS}). ` +
        'Either restore the previous EMBEDDING_MODEL, or migrate the column and re-index ' +
        'the whole corpus — mixed-width vectors cannot be compared.',
    );
  }
}
