import type { SearchMode } from '@rag/shared';
import { hybridSearch } from './hybrid';
import type { SearchOptions, SearchResult } from './types';
import { vectorSearch } from './vector';

export interface SearchRequestOptions extends SearchOptions {
  mode?: SearchMode;
}

/**
 * The single retrieval entry point. The chat page, the dashboard and the MCP server all
 * call this — MCP is a transport adapter, never a second implementation.
 *
 * Hybrid is the default; 'vector' exists so the eval can produce the before/after table
 * and so a regression in the keyword arm is diagnosable without editing code.
 */
export function search(options: SearchRequestOptions): Promise<SearchResult> {
  return options.mode === 'vector' ? vectorSearch(options) : hybridSearch(options);
}
