import { describe, expect, it } from 'vitest';
import { extractMetadata, hashContent, normaliseContent } from './loader';

describe('extractMetadata — filename patterns', () => {
  it('reads merchant and period from a month-dated settlement report', () => {
    const meta = extractMetadata(
      'settlement-reports/2026-05-brindle-market.md',
      '# Settlement Report: Brindle Market, 2026-05\n\nMerchant: Brindle Market | Currency: EUR',
    );

    expect(meta.docType).toBe('settlement-report');
    expect(meta.project).toBe('brindle-market');
    expect(meta.period).toBe('2026-05');
    expect(meta.title).toBe('Settlement Report: Brindle Market, 2026-05');
  });

  it('takes only the period from a month-dated incident, not the incident name', () => {
    const meta = extractMetadata(
      'incidents/2026-04-duplicate-payouts.md',
      '# Incident Review: Duplicate Payouts',
    );

    expect(meta.docType).toBe('incident');
    expect(meta.period).toBe('2026-04');
    // Same filename shape as a settlement report, but "duplicate-payouts" is an incident.
    expect(meta.project).toBeNull();
  });

  it('takes only the period from release notes, not the version', () => {
    const meta = extractMetadata('release-notes/2026-05-api-2.4.md', '# Release Notes: API 2.4');

    expect(meta.docType).toBe('release-note');
    expect(meta.period).toBe('2026-05');
    expect(meta.project).toBeNull();
  });

  it('reads the merchant from an undated merchant profile', () => {
    const meta = extractMetadata(
      'merchants/brindle-market.md',
      '# Merchant Profile: Brindle Market',
    );

    expect(meta.docType).toBe('merchant-profile');
    expect(meta.project).toBe('brindle-market');
    expect(meta.period).toBeNull();
  });

  it('leaves a root reference document with neither project nor period', () => {
    const meta = extractMetadata('glossary.md', '# Glossary');

    expect(meta.docType).toBe('reference');
    expect(meta.project).toBeNull();
    expect(meta.period).toBeNull();
  });
});

describe('extractMetadata — deprecation status', () => {
  it('marks the deprecated API reference as deprecated', () => {
    const content = [
      '# Payments API v1',
      '',
      '> **DEPRECATED** — superseded by Payments API v2.',
    ].join('\n');

    expect(extractMetadata('api/payments-api-v1.md', content).status).toBe('deprecated');
  });

  it('does not mark a current document deprecated for saying "supersedes"', () => {
    // A looser /supersede/ pattern would deprecate the current reference and down-weight
    // the correct answer — trap 1 inverted.
    const content = ['# Payments API v2', '', 'v2 is the current version. It supersedes v1.'].join(
      '\n',
    );

    expect(extractMetadata('api/payments-api-v2.md', content).status).toBe('current');
  });
});

describe('content normalisation', () => {
  it('hashes CRLF and LF versions of the same text identically', () => {
    // Without this, a CRLF checkout reports every document as changed on every
    // incremental run and the pipeline looks broken.
    const lf = '# Title\n\nFirst line.\nSecond line.\n';
    const crlf = '# Title\r\n\r\nFirst line.\r\nSecond line.\r\n';

    expect(normaliseContent(crlf)).toBe(lf);
    expect(hashContent(normaliseContent(crlf))).toBe(hashContent(normaliseContent(lf)));
  });

  it('produces different hashes for genuinely different content', () => {
    expect(hashContent('a')).not.toBe(hashContent('b'));
  });
});
