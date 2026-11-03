import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';
import { buildUserPrompt, SYSTEM_PROMPT } from './prompt';
import type { AnswerRequest, LlmProvider, LlmStream } from './types';

const DEFAULT_MODEL = 'gemini-2.5-flash';

export interface GeminiProviderOptions {
  apiKey: string;
  model?: string;
}

/**
 * Gemini via the Vercel AI SDK, using `streamText`.
 *
 * Streaming rather than `generateObject` is a deliberate deviation from an earlier version
 * of the spec, which asked for structured output so citations would never be parsed out of
 * free text. `generateObject` cannot stream, and streaming answers is a bonus the case
 * lists. The security property is unchanged, because it never rested on the output format:
 * every `[n]` the model emits is validated against the retrieved passages afterwards, and
 * an invented marker is stripped either way.
 */
export class GeminiProvider implements LlmProvider {
  readonly id: string;
  readonly mode = 'generative' as const;
  private readonly model: ReturnType<ReturnType<typeof createGoogleGenerativeAI>>;

  constructor(options: GeminiProviderOptions) {
    const modelId = options.model ?? DEFAULT_MODEL;
    this.id = `google:${modelId}`;
    // The key is passed explicitly rather than read from the ambient environment, so a
    // caller can supply it and the failure mode is a clear error rather than a 401.
    this.model = createGoogleGenerativeAI({ apiKey: options.apiKey })(modelId);
  }

  stream(request: AnswerRequest): LlmStream {
    const result = streamText({
      model: this.model,
      system: SYSTEM_PROMPT,
      prompt: buildUserPrompt(request.question, request.passages),
    });

    return {
      textStream: result.textStream,
      text: Promise.resolve(result.text),
    };
  }
}
