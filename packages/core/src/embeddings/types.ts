/**
 * The seam that keeps the rest of core independent of any particular model or vendor.
 * Retrieval, ingestion and evaluation all talk to this, never to Transformers.js.
 */
export interface EmbeddingProvider {
  /** Model identifier, stored on every document so a model change is detectable. */
  readonly id: string;
  /** Vector width. Must match the chunks.embedding column. */
  readonly dimensions: number;

  /**
   * Embeds passages for indexing. Implementations must batch internally rather than
   * looping one text at a time.
   */
  embedDocuments(texts: string[]): Promise<number[][]>;

  /**
   * Embeds a search query. For asymmetric models this is NOT the same operation as
   * embedDocuments on the same string — see LocalEmbeddings.
   */
  embedQuery(text: string): Promise<number[]>;
}
