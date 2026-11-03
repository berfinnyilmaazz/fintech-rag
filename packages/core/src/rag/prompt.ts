import type { RetrievedChunk } from '@rag/shared';
import { NO_ANSWER_TEXT } from './types';

/**
 * The instruction the model answers under. The deprecation line is the third leg of the
 * trap-1 mitigation: ingestion detects the status, retrieval demotes it, and this makes the
 * model say out loud that the old version is retired instead of quietly preferring the
 * current one.
 */
export const SYSTEM_PROMPT = [
  'You answer questions using ONLY the numbered source passages provided.',
  '- Cite every claim with the source number in square brackets, e.g. [1], [2].',
  '- If a source is marked status: deprecated, prefer the current one AND explicitly state',
  '  that the deprecated version is no longer valid.',
  '- If the passages do not answer the question, say exactly:',
  `  "${NO_ANSWER_TEXT}" Do not invent information or citations.`,
  '- Be concise and direct.',
].join('\n');

/**
 * Passages are numbered from 1 and carry their metadata header, so the model can see which
 * source is deprecated and which project or period a passage belongs to.
 */
export function buildUserPrompt(question: string, passages: RetrievedChunk[]): string {
  const sources = passages.map((passage, index) =>
    [
      `[${index + 1}] ${passage.title}`,
      `source: ${passage.sourcePath} | status: ${passage.status}` +
        (passage.project ? ` | project: ${passage.project}` : '') +
        (passage.period ? ` | period: ${passage.period}` : ''),
      '',
      passage.content,
    ].join('\n'),
  );

  return [
    'Source passages:',
    '',
    sources.join('\n\n---\n\n'),
    '',
    '---',
    '',
    `Question: ${question}`,
  ].join('\n');
}
