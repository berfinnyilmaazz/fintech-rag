import { ExtractiveProvider } from './extractive';
import { GeminiProvider } from './gemini';
import type { LlmProvider } from './types';

/**
 * Resolves the answer provider from the environment.
 *
 * An unrecognised LLM_PROVIDER throws rather than falling back — silently answering with a
 * different model than the operator configured is the kind of thing nobody notices until
 * the bill or the output is wrong.
 *
 * A *missing key* is different from a *wrong setting*: `gemini` selected with no key falls
 * back to extractive mode with a warning, because the case requires the system to run on a
 * fresh machine with no credentials at all.
 */
export function getLlmProvider(): LlmProvider {
  const provider = process.env.LLM_PROVIDER ?? 'none';

  switch (provider) {
    case 'none':
      return new ExtractiveProvider();

    case 'gemini': {
      const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      if (!apiKey || apiKey.trim() === '') {
        console.warn(
          'LLM_PROVIDER=gemini but GOOGLE_GENERATIVE_AI_API_KEY is empty — falling back to extractive mode.',
        );
        return new ExtractiveProvider();
      }
      return new GeminiProvider({ apiKey, model: process.env.GEMINI_MODEL });
    }

    case 'ollama':
      throw new Error(
        'LLM_PROVIDER=ollama is declared in .env.example but not implemented. Use gemini or none.',
      );

    default:
      throw new Error(`Unknown LLM_PROVIDER "${provider}". Supported values: gemini, none.`);
  }
}
