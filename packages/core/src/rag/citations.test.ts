import type { RetrievedChunk } from '@rag/shared';
import { describe, expect, it } from 'vitest';
import { validateCitations } from './citations';

function passage(n: number): RetrievedChunk {
  return {
    chunkId: `chunk-${n}`,
    documentId: `doc-${n}`,
    title: `Document ${n}`,
    sourcePath: `docs/document-${n}.md`,
    docType: 'reference',
    project: null,
    period: null,
    status: 'current',
    content: `Body of document ${n}.`,
    score: 0.03,
    cosine: 0.8,
    vectorRank: n,
    keywordRank: null,
  };
}

/** topK = 6, matching the default the answer path retrieves with. */
const PASSAGES = Array.from({ length: 6 }, (_, i) => passage(i + 1));

describe('validateCitations', () => {
  it('strips a citation the model invented beyond the retrieved set', () => {
    // The whole point of this layer: the prompt asks the model to cite only what it was
    // given, and this is what happens when it does not.
    const answer = 'Audio is built separately [3]. It was also changed in March [9].';

    const { text, citations } = validateCitations(answer, PASSAGES);

    expect(text).not.toContain('[9]');
    expect(text).toBe('Audio is built separately [3]. It was also changed in March.');
    expect(citations.map((c) => c.index)).toEqual([3]);
  });

  it('strips several invented citations at once and keeps the valid ones', () => {
    const answer = 'A [1] B [7] C [2] D [42] E [0].';

    const { text, citations } = validateCitations(answer, PASSAGES);

    expect(text).toBe('A [1] B C [2] D E.');
    expect(citations.map((c) => c.index)).toEqual([1, 2]);
  });

  it('resolves a valid citation to the real document behind it', () => {
    const { citations } = validateCitations('Answer [4].', PASSAGES);

    expect(citations).toEqual([
      { index: 4, documentId: 'doc-4', title: 'Document 4', sourcePath: 'docs/document-4.md' },
    ]);
  });

  it('accepts the boundary indices and rejects one past the end', () => {
    const { citations } = validateCitations('[1] and [6] exist, [7] does not.', PASSAGES);

    expect(citations.map((c) => c.index)).toEqual([1, 6]);
  });

  it('does not duplicate a citation the model repeats', () => {
    const { text, citations } = validateCitations('First [2], again [2], third [2].', PASSAGES);

    expect(text).toBe('First [2], again [2], third [2].');
    expect(citations.map((c) => c.index)).toEqual([2]);
  });

  it('returns citations in index order regardless of where they appear', () => {
    const { citations } = validateCitations('Later [5] then earlier [1].', PASSAGES);

    expect(citations.map((c) => c.index)).toEqual([1, 5]);
  });

  it('strips every citation when nothing was retrieved', () => {
    // The refusal path retrieves nothing, so an answer that still cites must end up bare.
    const { text, citations } = validateCitations('The corpus does not cover this [1].', []);

    expect(text).toBe('The corpus does not cover this.');
    expect(citations).toEqual([]);
  });

  it('leaves an answer with no citations untouched', () => {
    const answer = 'The corpus does not cover this.';

    expect(validateCitations(answer, PASSAGES)).toEqual({ text: answer, citations: [] });
  });
});
