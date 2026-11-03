import type { AnswerRequest, LlmProvider, LlmStream } from './types';

/**
 * The no-API-key path. It writes no prose of its own — it returns the retrieved passages,
 * numbered so the citation list resolves exactly as it would for a generated answer.
 *
 * This exists because anyone cloning the project runs it on a machine without our keys.
 * A missing key must degrade the answer, never fail the request.
 */
export class ExtractiveProvider implements LlmProvider {
  readonly id = 'extractive';
  readonly mode = 'extractive' as const;

  stream(request: AnswerRequest): LlmStream {
    const text = render(request);
    return {
      text: Promise.resolve(text),
      textStream: (async function* () {
        yield text;
      })(),
    };
  }
}

/**
 * The banner is not decoration. Without a model, nothing has judged whether these passages
 * answer the question — an out-of-corpus question in domain vocabulary still retrieves six
 * confident-looking passages. Anyone reading this output, including someone running
 * the project with no API key, has to be able to see at a glance that it is a search
 * result and not an answer.
 */
const BANNER = 'Retrieved passages · no answer generated';

function render({ passages }: AnswerRequest): string {
  if (passages.length === 0) {
    return `${BANNER}\n\nNo passages matched this question.`;
  }

  const body = passages.map((passage, index) => {
    const meta = [
      passage.sourcePath,
      passage.status === 'deprecated' ? 'DEPRECATED — superseded, do not rely on this' : null,
      passage.project,
      passage.period,
    ]
      .filter((part): part is string => part !== null)
      .join(' · ');

    return `[${index + 1}] ${passage.title}\n${meta}\n\n${passage.content}`;
  });

  return [
    BANNER,
    '',
    'No answer model is configured. These are the passages retrieved for the question,',
    'most relevant first. Nothing here has been checked against the question — the corpus',
    'may not answer it at all.',
    '',
    body.join('\n\n---\n\n'),
  ].join('\n');
}
