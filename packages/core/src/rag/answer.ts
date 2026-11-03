import { type Db, db as defaultDb, searchLogs } from '@rag/db';
import type { Answer, SearchMode } from '@rag/shared';
import type { EmbeddingProvider } from '../embeddings/index';
import { DEFAULT_TOP_K, search } from '../retrieval/index';
import { validateCitations } from './citations';
import { getLlmProvider } from './provider';
import {
  type AnswerRequest,
  type LlmProvider,
  NO_ANSWER_COSINE_THRESHOLD,
  NO_ANSWER_TEXT,
} from './types';

export interface AskOptions {
  query: string;
  topK?: number;
  mode?: SearchMode;
  db?: Db;
  embeddings?: EmbeddingProvider;
  llm?: LlmProvider;
  userId?: string | null;
  /** Receives tokens as they arrive. The validated answer is still returned at the end. */
  onToken?: (token: string) => void;
  /** Skips the search_logs write. Used by the eval so measurement runs stay out of analytics. */
  log?: boolean;
}

export interface AskResult extends Answer {
  passages: AnswerRequest['passages'];
  topCosine: number | null;
  latencyMs: number;
  /** Split out so the UI can show where the time went; generation is latencyMs - retrievalMs. */
  retrievalMs: number;
}

/**
 * Retrieve, guard, generate, validate, log.
 *
 * The guard reads `topCosine` from the search result — the best similarity anywhere in the
 * vector candidate pool — and not `passages[0].cosine`. Fusion can put a keyword-only chunk
 * first, and that chunk has no vector distance at all.
 */
export async function ask(options: AskOptions): Promise<AskResult> {
  const startedAt = performance.now();
  const database = options.db ?? defaultDb;
  const topK = options.topK ?? DEFAULT_TOP_K;

  const retrieval = await search({
    query: options.query,
    topK,
    mode: options.mode ?? 'hybrid',
    db: database,
    embeddings: options.embeddings,
  });

  const llm = options.llm ?? getLlmProvider();
  const belowThreshold =
    retrieval.topCosine === null || retrieval.topCosine < NO_ANSWER_COSINE_THRESHOLD;

  let result: AskResult;

  if (belowThreshold || retrieval.chunks.length === 0) {
    // No model call at all: nothing in the corpus is close enough for an answer to be
    // grounded in it, so generating one would only invite invention.
    options.onToken?.(NO_ANSWER_TEXT);
    result = {
      answer: NO_ANSWER_TEXT,
      citations: [],
      grounded: false,
      mode: llm.mode,
      passages: [],
      topCosine: retrieval.topCosine,
      latencyMs: Math.round(performance.now() - startedAt),
      retrievalMs: retrieval.latencyMs,
    };
  } else {
    const stream = llm.stream({ question: options.query, passages: retrieval.chunks });

    let raw = '';
    for await (const token of stream.textStream) {
      raw += token;
      options.onToken?.(token);
    }
    // `text` resolves to the same content; awaiting it surfaces a mid-stream provider error
    // rather than silently returning a truncated answer.
    await stream.text;

    const { text, citations } = validateCitations(raw, retrieval.chunks);
    const refused = text.trim().startsWith(NO_ANSWER_TEXT);

    result = {
      answer: text.trim(),
      citations: refused ? [] : citations,
      /**
       * Only a generated answer can be grounded. Extractive mode returns the passages the
       * search found without any claim that they answer the question — it has no way to
       * judge that — so reporting it as grounded would inflate the dashboard's grounded
       * rate with questions the corpus never answered.
       */
      grounded: llm.mode === 'generative' && !refused && citations.length > 0,
      mode: llm.mode,
      passages: retrieval.chunks,
      topCosine: retrieval.topCosine,
      latencyMs: Math.round(performance.now() - startedAt),
      retrievalMs: retrieval.latencyMs,
    };
  }

  if (options.log !== false) {
    await database.insert(searchLogs).values({
      userId: options.userId ?? null,
      query: options.query,
      mode: result.mode,
      topCosine: retrieval.topCosine,
      resultCount: result.passages.length,
      grounded: result.grounded,
      latencyMs: result.latencyMs,
    });
  }

  return result;
}
