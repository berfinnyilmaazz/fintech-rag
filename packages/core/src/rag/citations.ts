import type { Citation, RetrievedChunk } from '@rag/shared';

const CITATION_MARKER = /\[(\d+)\]/g;

export interface ValidatedAnswer {
  /** The answer with every unresolvable marker removed. */
  text: string;
  /** Only markers that map to a real retrieved passage, in order of first appearance. */
  citations: Citation[];
}

/**
 * Strips any `[n]` the model emitted that does not map to a retrieved passage, and builds
 * the citation list from what survives.
 *
 * This is the security boundary for grounding, and it does not rest on the prompt. A model
 * that invents `[9]` when six passages were retrieved has that marker removed regardless of
 * what it was told, and the invented source never reaches the citation list the UI renders.
 * Instructing the model is a request; this is the enforcement.
 */
export function validateCitations(answer: string, passages: RetrievedChunk[]): ValidatedAnswer {
  const seen = new Set<number>();
  const citations: Citation[] = [];

  const text = answer.replace(CITATION_MARKER, (marker, digits: string) => {
    const index = Number(digits);
    const passage = passages[index - 1];

    if (!Number.isInteger(index) || index < 1 || passage === undefined) {
      return '';
    }

    if (!seen.has(index)) {
      seen.add(index);
      citations.push({
        index,
        documentId: passage.documentId,
        title: passage.title,
        sourcePath: passage.sourcePath,
      });
    }
    return marker;
  });

  // Removing a marker can leave a double space or a space before punctuation.
  const tidied = text.replace(/[ \t]{2,}/g, ' ').replace(/\s+([.,;:!?])/g, '$1');

  return { text: tidied, citations: citations.sort((a, b) => a.index - b.index) };
}
