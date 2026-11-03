import { describe, expect, it } from 'vitest';
import {
  buildEmbeddedText,
  CHUNK_OVERLAP_TOKENS,
  chunkDocument,
  MAX_CHUNK_TOKENS,
} from './chunker';
import { countTokens, decodeTokens, encodeTokens } from './tokens';

/** Builds prose of roughly `tokens` length; one word is about one token in cl100k. */
function proseOf(tokens: number, word = 'settlement'): string {
  return Array.from({ length: tokens }, () => word).join(' ');
}

describe('chunkDocument', () => {
  it('keeps a document the size of this corpus in a single chunk', () => {
    // The largest real document is ~220 tokens. Splitting it would fragment context that
    // is already coherent, so the chunker must leave it alone.
    const content = `# Settlement Report: Brindle Market, 2026-05\n\n${proseOf(200)}`;
    expect(countTokens(content)).toBeLessThanOrEqual(MAX_CHUNK_TOKENS);

    const chunks = chunkDocument(content);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.content).toBe(content);
    expect(chunks[0]?.index).toBe(0);
  });

  it('splits a document well over the threshold', () => {
    const content = [
      '# Big Document',
      '',
      proseOf(400, 'alpha'),
      '## Second Section',
      proseOf(400, 'beta'),
      '## Third Section',
      proseOf(400, 'gamma'),
    ].join('\n');
    expect(countTokens(content)).toBeGreaterThan(1000);

    const chunks = chunkDocument(content);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.map((chunk) => chunk.index)).toEqual(chunks.map((_, i) => i));
    // Every chunk stays under the hard limit even after overlap is prepended.
    for (const chunk of chunks) {
      expect(chunk.tokenCount).toBeLessThanOrEqual(MAX_CHUNK_TOKENS);
    }
  });

  it('overlaps consecutive chunks by exactly the configured token count', () => {
    const content = [
      '# Big Document',
      '',
      proseOf(400, 'alpha'),
      '## Second Section',
      proseOf(400, 'beta'),
      '## Third Section',
      proseOf(400, 'gamma'),
    ].join('\n');

    const chunks = chunkDocument(content);
    expect(chunks.length).toBeGreaterThan(1);

    for (let i = 1; i < chunks.length; i++) {
      const previous = chunks[i - 1]?.content ?? '';
      const current = chunks[i]?.content ?? '';
      const tail = decodeTokens(encodeTokens(previous).slice(-CHUNK_OVERLAP_TOKENS));

      expect(current.startsWith(tail)).toBe(true);
      expect(countTokens(tail)).toBe(CHUNK_OVERLAP_TOKENS);
    }
  });

  it('honours an explicit overlap of zero', () => {
    const content = `# Big Document\n\n${proseOf(1200, 'alpha')}`;
    const chunks = chunkDocument(content, { target: 200, overlap: 0 });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.map((chunk) => chunk.content).join('')).toContain('alpha');
  });
});

describe('buildEmbeddedText', () => {
  it('puts metadata in the embedded text and leaves the shown content untouched', () => {
    const metadata = {
      docType: 'settlement-report',
      title: 'Settlement Report: Brindle Market, 2026-05',
      project: 'brindle-market',
      period: '2026-05',
      status: 'current',
    } as const;
    const content =
      '# Settlement Report: Brindle Market, 2026-05\n\nMerchant: Brindle Market | Currency: EUR';

    const embedded = buildEmbeddedText(metadata, content);

    expect(embedded).toBe(
      '[settlement-report] Settlement Report: Brindle Market, 2026-05\n' +
        'project: brindle-market | period: 2026-05 | status: current\n' +
        '\n' +
        content,
    );
    // The slug and the period are what separate otherwise-identical settlement reports.
    expect(embedded).toContain('brindle-market');
    expect(content).not.toContain('project:');
  });

  it('renders missing project and period as a dash', () => {
    const embedded = buildEmbeddedText(
      {
        docType: 'reference',
        title: 'Payments API v1',
        project: null,
        period: null,
        status: 'deprecated',
      },
      'body',
    );

    expect(embedded).toContain('project: - | period: - | status: deprecated');
  });
});
