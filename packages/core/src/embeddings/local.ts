import { resolve } from 'node:path';
import { type FeatureExtractionPipeline, pipeline } from '@huggingface/transformers';
import { EMBEDDING_DIMENSIONS } from '@rag/shared';
import { REPO_ROOT } from '../paths';
import type { EmbeddingProvider } from './types';

/**
 * BGE models are asymmetric: they were trained with queries carrying this instruction and
 * passages carrying nothing, so the two sides are not embedded the same way.
 *
 * `pnpm eval` measures the pipeline with and without it (the `no query prefix` variant);
 * the numbers are in EVAL_RESULTS.md. Do not flip this on a hunch.
 */
const QUERY_PREFIX = 'Represent this sentence for searching relevant passages: ';

const DEFAULT_MODEL = 'Xenova/bge-small-en-v1.5';

/**
 * Texts per forward pass. The whole corpus in one call would allocate a
 * [docs, seq_len, 384] intermediate before pooling; batching keeps that bounded without
 * giving up batched inference.
 */
const DEFAULT_BATCH_SIZE = 32;

export interface LocalEmbeddingsOptions {
  model?: string;
  dimensions?: number;
  /** Where the ~127 MB fp32 model is cached. Defaults to .models/ at the repo root. */
  cacheDir?: string;
  batchSize?: number;
}

export class LocalEmbeddings implements EmbeddingProvider {
  readonly id: string;
  readonly dimensions: number;
  private readonly cacheDir: string;
  private readonly batchSize: number;
  private pipelinePromise: Promise<FeatureExtractionPipeline> | null = null;

  constructor(options: LocalEmbeddingsOptions = {}) {
    this.id = options.model ?? DEFAULT_MODEL;
    this.dimensions = options.dimensions ?? EMBEDDING_DIMENSIONS;
    this.cacheDir = options.cacheDir ?? resolve(REPO_ROOT, '.models');
    this.batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  }

  /**
   * One pipeline per instance, loaded once. Concurrent callers share the same in-flight
   * promise instead of each triggering a download; a failed load is cleared so a later
   * call can retry rather than caching the rejection forever.
   */
  private getPipeline(): Promise<FeatureExtractionPipeline> {
    this.pipelinePromise ??= pipeline('feature-extraction', this.id, {
      dtype: 'fp32',
      cache_dir: this.cacheDir,
    }).catch((error: unknown) => {
      this.pipelinePromise = null;
      throw error;
    });
    return this.pipelinePromise;
  }

  /** Loads the model without embedding anything, so callers can time it explicitly. */
  async warmup(): Promise<void> {
    await this.getPipeline();
  }

  private async embedBatch(texts: string[]): Promise<number[][]> {
    const extract = await this.getPipeline();
    const output = await extract(texts, { pooling: 'mean', normalize: true });

    // Both Tensor.data and Tensor.tolist() are loosely typed in Transformers.js
    // (DataArray / any[]), so narrow instead of asserting.
    const raw: unknown = output.data;
    if (!(raw instanceof Float32Array)) {
      throw new Error(
        `${this.id}: expected Float32Array from the pipeline, got ${Object.prototype.toString.call(raw)}`,
      );
    }

    const dims = output.dims;
    const rows = dims[0];
    const width = dims[1];
    if (dims.length !== 2 || rows === undefined || width === undefined) {
      throw new Error(`${this.id}: expected a 2-D tensor, got dims [${dims.join(', ')}]`);
    }
    if (rows !== texts.length || width !== this.dimensions) {
      throw new Error(
        `${this.id}: expected [${texts.length}, ${this.dimensions}], got [${rows}, ${width}]`,
      );
    }

    const vectors: number[][] = [];
    for (let row = 0; row < rows; row++) {
      vectors.push(Array.from(raw.subarray(row * width, (row + 1) * width)));
    }
    return vectors;
  }

  /** No prefix — passages are embedded exactly as they will be searched against. */
  async embedDocuments(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const vectors: number[][] = [];
    for (let start = 0; start < texts.length; start += this.batchSize) {
      vectors.push(...(await this.embedBatch(texts.slice(start, start + this.batchSize))));
    }
    return vectors;
  }

  /** Prefixed — see QUERY_PREFIX. */
  async embedQuery(text: string): Promise<number[]> {
    const [vector] = await this.embedBatch([QUERY_PREFIX + text]);
    if (!vector) {
      throw new Error(`${this.id}: embedding the query returned no vector`);
    }
    return vector;
  }
}

export { QUERY_PREFIX };
