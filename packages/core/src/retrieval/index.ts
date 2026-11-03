export { hybridSearch } from './hybrid';
export { cosineSimilarity, MMR_LAMBDA, MMR_POOL, type MmrItem, selectMmr } from './mmr';
export { hasRecencyCue, promoteLatest, type RecencyItem } from './recency';
export {
  cosineFromDistance,
  type HybridRow,
  HybridRowSchema,
  parseEmbedding,
  parseRows,
  type VectorRow,
  VectorRowSchema,
} from './rows';
export { type SearchRequestOptions, search } from './search';
export {
  CANDIDATE_POOL,
  DEFAULT_KEYWORD_MODE,
  DEFAULT_MMR,
  DEFAULT_RECENCY,
  DEFAULT_TOP_K,
  DEPRECATED_RANK_PENALTY,
  type KeywordMode,
  RRF_K,
  type SearchOptions,
  type SearchResult,
} from './types';
export { vectorSearch } from './vector';
