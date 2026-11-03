/**
 * A recency tie-break for "latest" questions — not a query-rewriting layer.
 *
 * Release notes and settlement reports are written to one template, so "what changed in the
 * latest API release?" is about equally similar to all ten release notes, and nothing in the
 * text says which one is newest. The period extracted from the path does.
 *
 * The rule: find the highest-ranked candidate that has a period (the anchor), then promote
 * the newest candidate of the same kind — same doc type, same merchant — into the anchor's
 * position. Everything else keeps its order. An undated document ranked above the anchor
 * stays above it, so the cue can reorder a series of dated documents but never lift one over
 * a reference document the query matched better.
 *
 * Deliberately narrow cue words. "current" is excluded because "the current Payments API"
 * asks for the non-deprecated version, which is not a date question; "last" is excluded
 * because "last funding round" or "last step" are not either.
 */
const RECENCY_CUE = /\b(latest|most recent|newest)\b/i;

export function hasRecencyCue(query: string): boolean {
  return RECENCY_CUE.test(query);
}

export interface RecencyItem {
  doc_type: string;
  project: string | null;
  period: string | null;
}

export function promoteLatest<T extends RecencyItem>(items: readonly T[]): T[] {
  const anchorIndex = items.findIndex((item) => item.period !== null);
  const anchor = items[anchorIndex];
  if (!anchor?.period) return [...items];

  let newestIndex = anchorIndex;
  let newestPeriod = anchor.period;
  items.forEach((item, index) => {
    const sameKind = item.doc_type === anchor.doc_type && item.project === anchor.project;
    // "YYYY-MM" sorts lexically. Strictly newer only, so equal periods keep their rank order.
    if (sameKind && item.period !== null && item.period > newestPeriod) {
      newestIndex = index;
      newestPeriod = item.period;
    }
  });

  const result = [...items];
  if (newestIndex === anchorIndex) return result;
  const [moved] = result.splice(newestIndex, 1);
  if (moved) result.splice(anchorIndex, 0, moved);
  return result;
}
