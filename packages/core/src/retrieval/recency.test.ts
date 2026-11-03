import { describe, expect, it } from 'vitest';
import { hasRecencyCue, promoteLatest, type RecencyItem } from './recency';

function item(id: string, doc_type: string, period: string | null, project: string | null = null) {
  return { id, doc_type, period, project } satisfies RecencyItem & { id: string };
}

describe('hasRecencyCue', () => {
  it('fires on latest, most recent and newest', () => {
    expect(hasRecencyCue('What changed in the latest API release?')).toBe(true);
    expect(hasRecencyCue("Brindle Market's most recent settlement report")).toBe(true);
    expect(hasRecencyCue('the newest incident')).toBe(true);
  });

  it('does not fire on "current", which asks for the non-deprecated version', () => {
    expect(hasRecencyCue('How do I create a payment with the current Payments API?')).toBe(false);
  });
});

describe('promoteLatest', () => {
  it('moves the newest document of the anchor kind into the anchor position', () => {
    const ranked = [
      item('ref', 'api-reference', null),
      item('2.4', 'release-note', '2026-05'),
      item('policy', 'policy', null),
      item('2.9', 'release-note', '2026-10'),
    ];

    expect(promoteLatest(ranked).map((r) => r.id)).toEqual(['ref', '2.9', '2.4', 'policy']);
  });

  it('only considers the same merchant', () => {
    const ranked = [
      item('brindle-05', 'settlement-report', '2026-05', 'brindle-market'),
      item('copper-10', 'settlement-report', '2026-10', 'copperline'),
      item('brindle-08', 'settlement-report', '2026-08', 'brindle-market'),
    ];

    expect(promoteLatest(ranked).map((r) => r.id)).toEqual([
      'brindle-08',
      'brindle-05',
      'copper-10',
    ]);
  });

  it('leaves a list without dated documents untouched', () => {
    const ranked = [item('a', 'policy', null), item('b', 'runbook', null)];
    expect(promoteLatest(ranked)).toEqual(ranked);
  });
});
