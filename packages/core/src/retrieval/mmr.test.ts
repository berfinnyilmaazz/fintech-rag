import { describe, expect, it } from 'vitest';
import { cosineSimilarity, MMR_LAMBDA, selectMmr } from './mmr';

/** Orthogonal unit vectors, plus one near-duplicate of A. Easy to reason about by hand. */
const A = [1, 0, 0, 0];
const A_NEAR = [0.99, 0.14, 0, 0];
const B = [0, 1, 0, 0];
const C = [0, 0, 1, 0];
const D = [0, 0, 0, 1];

const item = (id: string, embedding: number[]) => ({ id, embedding });

/** Fused order: a near-duplicate of the winner sits at rank 2, ahead of three distinct docs. */
const POOL = [item('1', A), item('2', A_NEAR), item('3', B), item('4', C), item('5', D)];

describe('cosineSimilarity', () => {
  it('is 1 for identical vectors and 0 for orthogonal ones', () => {
    expect(cosineSimilarity(A, A)).toBeCloseTo(1);
    expect(cosineSimilarity(A, B)).toBeCloseTo(0);
  });

  it('normalises, so magnitude does not matter', () => {
    expect(cosineSimilarity([2, 0, 0, 0], [0.5, 0, 0, 0])).toBeCloseTo(1);
  });

  it('returns 0 rather than NaN for a zero vector', () => {
    expect(cosineSimilarity([0, 0, 0, 0], A)).toBe(0);
  });
});

describe('selectMmr', () => {
  // λ is passed explicitly throughout: it is a tuning constant measured against the corpus,
  // and a test whose meaning silently changes when it is retuned is not pinning anything.
  it('always keeps the top-ranked candidate first', () => {
    expect(selectMmr(POOL, 3, 0.7)[0]?.id).toBe('1');
    expect(selectMmr(POOL, 3, 0.5)[0]?.id).toBe('1');
  });

  it('skips a near-duplicate in favour of a lower-ranked but distinct candidate', () => {
    expect(selectMmr(POOL, 2, 0.7).map((row) => row.id)).toEqual(['1', '3']);
  });

  it('demotes the near-duplicate rather than dropping it', () => {
    // The whole point of a diversity pass over a *fused* list: once the redundancy is
    // covered by something else, the duplicate is still the most relevant thing left. A
    // filter would have removed it.
    expect(selectMmr(POOL, 3, 0.7).map((row) => row.id)).toEqual(['1', '3', '2']);
    // Lower λ pushes it further down, but it is still returned.
    expect(selectMmr(POOL, 5, 0.5).map((row) => row.id)).toEqual(['1', '3', '4', '5', '2']);
  });

  it('leaves an already-diverse list in its fused order', () => {
    const diverse = [item('1', A), item('2', B), item('3', C), item('4', D)];
    expect(selectMmr(diverse, 4, 0.5).map((row) => row.id)).toEqual(['1', '2', '3', '4']);
  });

  it('is prefix-consistent: a larger k never reorders what a smaller k chose', () => {
    const four = selectMmr(POOL, 4, 0.7).map((row) => row.id);
    expect(four.slice(0, 2)).toEqual(selectMmr(POOL, 2, 0.7).map((row) => row.id));
    expect(four.slice(0, 3)).toEqual(selectMmr(POOL, 3, 0.7).map((row) => row.id));
  });

  it('degenerates to the fused order at lambda = 1', () => {
    expect(selectMmr(POOL, 5, 1).map((row) => row.id)).toEqual(['1', '2', '3', '4', '5']);
  });

  it('returns every candidate, only reordered, when k exceeds the pool', () => {
    const selected = selectMmr(POOL, 10, 0.5);
    expect(selected).toHaveLength(5);
    expect([...selected.map((row) => row.id)].sort()).toEqual(['1', '2', '3', '4', '5']);
  });

  it('handles an empty pool and a k of zero', () => {
    expect(selectMmr([], 5)).toEqual([]);
    expect(selectMmr([item('1', A)], 0)).toEqual([]);
  });

  it('ships the lambda the eval measured', () => {
    // EVAL_RESULTS.md reports λ0.7 as inert and λ0.3 as costing MRR. If this constant moves,
    // the published table no longer describes what the application does.
    expect(MMR_LAMBDA).toBe(0.5);
  });
});
