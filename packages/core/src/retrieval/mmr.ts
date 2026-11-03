/**
 * Maximal Marginal Relevance over an already-fused candidate list.
 *
 * The problem it addresses is specific to this corpus: the monthly settlement reports draw
 * their highlights from a small pool of sentences, the most common repeated verbatim in
 * dozens of files. A query that
 * matches that sentence can fill all six result slots with documents that say the identical
 * thing — six citations carrying one fact, and a context window spent on repetition.
 *
 * ## Why relevance is a normalised rank and not the fused score
 *
 * The textbook formula is `λ·sim(q,d) − (1−λ)·max sim(d,dⱼ)`, and both terms are cosines,
 * so they share a scale. Substituting the RRF score for the first term breaks that: across a
 * 20-candidate pool an RRF value ranges over roughly 0.016–0.033, while the redundancy term
 * ranges over 0–1. The diversity half would outweigh relevance by a factor of ~30 and MMR
 * would degenerate into "pick the most different thing", ignoring the ranking entirely.
 *
 * This project has already been bitten twice by treating a rank-derived RRF value as if it
 * carried magnitude — the ×0.6 deprecated multiplier that turned into a filter, and the
 * no-answer threshold that had to move off the fused score onto raw cosine. So relevance
 * here is the candidate's fused **rank**, linearly mapped onto [0, 1]: rank 1 → 1.0, last
 * candidate → 0.0. That is a monotone transform, so RRF's ordering is preserved exactly; all
 * it does is put both halves of the formula on the same scale.
 *
 * ## Why λ is 0.5 and not the 0.7 the plan specified
 *
 * Relevance is spread evenly across the pool, so one rank step costs `λ/(n−1)` while
 * redundancy costs `(1−λ)·Δsim`. Swapping a candidate past its neighbour therefore needs
 * `Δsim > λ / ((1−λ)(n−1))`. Over a 20-candidate pool that threshold is:
 *
 *   λ = 0.7 → Δsim > 0.123   λ = 0.5 → Δsim > 0.053   λ = 0.3 → Δsim > 0.023
 *
 * BGE puts topically related documents at 0.85+ cosine of each other, so candidates for one
 * query sit inside a narrow similarity band and Δsim almost never clears 0.123, so λ = 0.7
 * is very nearly inert. λ = 0.3 needs only 0.023 and starts trading relevance for variety.
 * `pnpm eval` measures the repetitive settlement-report queries per λ; see EVAL_RESULTS.md.
 *
 * A query whose candidate pool is uniformly repetitive is untouched at every λ: there is
 * nothing less redundant to promote. MMR reorders a list; it cannot improve one.
 *
 * ## The pool size sets how hard the penalty bites, so it is fixed
 *
 * That threshold depends on `n`. Shrink the pool to 3 and one rank step costs 0.25 at
 * λ = 0.5, more than any redundancy penalty can recover, and MMR stops reordering entirely.
 * So the pool is a constant rather than `topK` — otherwise the strength of the diversity
 * pass would drift with how many results the caller happened to ask for. A unit test pins
 * this, and getting it wrong is what the first version of that test did.
 */

export interface MmrItem {
  embedding: number[];
}

/** Measured, not chosen. See the threshold arithmetic above and EVAL_RESULTS.md. */
export const MMR_LAMBDA = 0.5;

/** Fused candidates fetched before MMR narrows them to topK. */
export const MMR_POOL = 20;

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const length = Math.min(a.length, b.length);

  for (let i = 0; i < length; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }

  const norm = Math.sqrt(normA) * Math.sqrt(normB);
  return norm === 0 ? 0 : dot / norm;
}

/**
 * Greedy selection. `candidates` must already be in fused rank order — that order is the
 * relevance signal.
 *
 * Greedy means prefix-consistent: selecting 8 yields the same first 6 as selecting 6, which
 * is what lets the eval compare topK cutoffs against a single ranking.
 */
export function selectMmr<T extends MmrItem>(
  candidates: T[],
  k: number,
  lambda: number = MMR_LAMBDA,
): T[] {
  const limit = Math.min(k, candidates.length);
  if (limit <= 1) return candidates.slice(0, limit);

  const span = candidates.length - 1;
  const remaining = candidates.map((item, index) => ({ item, relevance: 1 - index / span }));
  const selected: T[] = [];

  while (selected.length < limit && remaining.length > 0) {
    let bestAt = 0;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (let at = 0; at < remaining.length; at++) {
      const candidate = remaining[at];
      if (!candidate) continue;

      let redundancy = 0;
      for (const picked of selected) {
        const similarity = cosineSimilarity(candidate.item.embedding, picked.embedding);
        if (similarity > redundancy) redundancy = similarity;
      }

      const score = lambda * candidate.relevance - (1 - lambda) * redundancy;
      if (score > bestScore) {
        bestScore = score;
        bestAt = at;
      }
    }

    const [winner] = remaining.splice(bestAt, 1);
    if (winner) selected.push(winner.item);
  }

  return selected;
}
