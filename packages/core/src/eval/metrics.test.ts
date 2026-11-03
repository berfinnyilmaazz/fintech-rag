import { describe, expect, it } from 'vitest';
import { mean, median, recallAt, reciprocalRank, toDocumentRanking } from './metrics';

const RANKING = ['a.md', 'b.md', 'c.md', 'd.md', 'e.md'];

describe('toDocumentRanking', () => {
  it('collapses repeated chunks of one document into a single rank position', () => {
    expect(toDocumentRanking(['a.md', 'a.md', 'b.md', 'a.md'])).toEqual(['a.md', 'b.md']);
  });
});

describe('recallAt', () => {
  it('counts the fraction of expected documents inside the cutoff', () => {
    expect(recallAt(RANKING, ['a.md'], 5)).toBe(1);
    expect(recallAt(RANKING, ['a.md', 'z.md'], 5)).toBe(0.5);
    expect(recallAt(RANKING, ['z.md'], 5)).toBe(0);
  });

  it('respects the cutoff', () => {
    expect(recallAt(RANKING, ['e.md'], 5)).toBe(1);
    expect(recallAt(RANKING, ['e.md'], 4)).toBe(0);
  });

  it('is 1 when nothing is expected, so refusal questions do not drag the mean down', () => {
    expect(recallAt(RANKING, [], 5)).toBe(1);
  });
});

describe('reciprocalRank', () => {
  it('is 1 when the first expected document ranks first', () => {
    expect(reciprocalRank(RANKING, ['a.md'], 10)).toBe(1);
  });

  it('uses the best-placed expected document, not the first one listed', () => {
    expect(reciprocalRank(RANKING, ['c.md', 'a.md'], 10)).toBe(1);
  });

  it('falls off as 1/rank', () => {
    expect(reciprocalRank(RANKING, ['c.md'], 10)).toBeCloseTo(1 / 3);
  });

  it('is 0 when no expected document is inside the cutoff', () => {
    expect(reciprocalRank(RANKING, ['e.md'], 4)).toBe(0);
    expect(reciprocalRank(RANKING, ['z.md'], 10)).toBe(0);
  });
});

describe('mean', () => {
  it('averages, and returns 0 for an empty list rather than NaN', () => {
    expect(mean([1, 0, 0.5])).toBeCloseTo(0.5);
    expect(mean([])).toBe(0);
  });
});

describe('median', () => {
  it('takes the middle value of an odd-length list', () => {
    expect(median([30, 10, 20])).toBe(20);
  });

  it('averages the two middle values of an even-length list', () => {
    expect(median([40, 10, 30, 20])).toBe(25);
  });

  it('ignores one extreme outlier, which is why latency uses it', () => {
    expect(median([10, 11, 12, 13, 4000])).toBe(12);
  });

  it('does not mutate its input', () => {
    const values = [3, 1, 2];
    median(values);
    expect(values).toEqual([3, 1, 2]);
  });

  it('returns 0 for an empty list rather than NaN', () => {
    expect(median([])).toBe(0);
  });
});
