import type { EvalVariant, GoldenQuestion, MeasuredSet, Measurement } from './metrics';
import { mean, median, recallAt, reciprocalRank } from './metrics';

/**
 * Markdown renderers for the eval. Pure string builders, kept out of the script so the
 * numbers that go into EVAL_RESULTS.md are produced by testable code rather than by inline
 * console.log formatting.
 */

export const RANK_DEPTH = 10;

/**
 * The full curve, not one number. recall@5 saturates at 100% on this golden set — every
 * variant finds the expected document within five results — so reporting only recall@5
 * would show six identical rows and hide the differences that exist at rank 1.
 */
export const CUTOFFS = [1, 3, 5, 6, 8] as const;

const row = (cells: Array<string | number>): string => `| ${cells.join(' | ')} |`;
const pct = (value: number): string => `${(value * 100).toFixed(1)}%`;

function table(header: Array<string | number>, alignments: string[], rows: string[]): string {
  return [row(header), row(alignments), ...rows].join('\n');
}

export function qualityTable(
  variants: readonly EvalVariant[],
  questions: GoldenQuestion[],
  results: ReadonlyMap<string, MeasuredSet>,
  threshold: number,
): string {
  const rows = variants.flatMap((variant) => {
    const measured = results.get(variant.id);
    if (!measured) return [];

    const per = questions.map((question) => ({ question, m: measured.get(question.id) }));
    const recalls = CUTOFFS.map((k) =>
      pct(mean(per.map(({ question, m }) => recallAt(m?.ranking ?? [], question.expected, k)))),
    );
    const mrr = mean(
      per.map(({ question, m }) => reciprocalRank(m?.ranking ?? [], question.expected, RANK_DEPTH)),
    );
    const latency = median(per.map(({ m }) => m?.latencyMs ?? 0));
    // An answerable question whose best cosine falls under the guard would be refused
    // before the model ever saw it. This is the cost side of the no-answer threshold.
    const falseRefusals = per.filter(
      ({ m }) => m !== undefined && (m.topCosine ?? 0) < threshold,
    ).length;

    return [
      row([
        variant.label,
        ...recalls,
        mrr.toFixed(3),
        `${Math.round(latency)} ms`,
        `${falseRefusals}/${questions.length}`,
      ]),
    ];
  });

  return table(
    ['variant', ...CUTOFFS.map((k) => `recall@${k}`), 'MRR@10', 'median latency', 'false refusals'],
    ['---', ...CUTOFFS.map(() => '---:'), '---:', '---:', '---:'],
    rows,
  );
}

export function supportingTable(
  variants: readonly EvalVariant[],
  questions: GoldenQuestion[],
  results: ReadonlyMap<string, MeasuredSet>,
): string {
  const withSupport = questions.filter((question) => question.supporting.length > 0);

  const rows = variants.flatMap((variant) => {
    const measured = results.get(variant.id);
    if (!measured) return [];
    const cells = CUTOFFS.map((k) =>
      pct(
        mean(
          withSupport.map((question) =>
            recallAt(measured.get(question.id)?.ranking ?? [], question.supporting, k),
          ),
        ),
      ),
    );
    return [row([variant.label, ...cells])];
  });

  return table(
    ['variant', ...CUTOFFS.map((k) => `@${k}`)],
    ['---', ...CUTOFFS.map(() => '---:')],
    rows,
  );
}

export function perQuestionTable(
  variants: readonly EvalVariant[],
  questions: GoldenQuestion[],
  results: ReadonlyMap<string, MeasuredSet>,
): string {
  const rows = questions.map((question) => {
    const cells = variants.map((variant) => {
      const ranking = results.get(variant.id)?.get(question.id)?.ranking ?? [];
      const position = ranking.findIndex((path) => question.expected.includes(path));
      return position === -1 ? `>${RANK_DEPTH}` : String(position + 1);
    });
    return row([question.id, ...cells]);
  });

  return table(
    ['question', ...variants.map((variant) => variant.id)],
    ['---', ...variants.map(() => '---:')],
    rows,
  );
}

export function refusalTable(
  variants: readonly EvalVariant[],
  questions: GoldenQuestion[],
  results: ReadonlyMap<string, MeasuredSet>,
  threshold: number,
): string {
  const rows = variants.flatMap((variant) => {
    const measured = results.get(variant.id);
    if (!measured) return [];
    const cosines = questions.map(
      (question): Measurement['topCosine'] => measured.get(question.id)?.topCosine ?? null,
    );
    const caught = cosines.filter((cosine) => cosine !== null && cosine < threshold).length;
    return [
      row([
        variant.label,
        ...cosines.map((cosine) => (cosine === null ? '—' : cosine.toFixed(4))),
        `${caught}/${questions.length}`,
      ]),
    ];
  });

  return table(
    ['variant', ...questions.map((question) => question.id), 'refused by layer 1'],
    ['---', ...questions.map(() => '---:'), '---:'],
    rows,
  );
}

export interface DiversityRow {
  query: string;
  variant: string;
  meanPairwiseCosine: number;
  distinctProjects: number;
  results: number;
}

/**
 * MMR is a diversity pass, so recall is the wrong instrument for it. These two columns are:
 * how similar the returned passages are to each other, and how many distinct projects they
 * come from — a query matching one of the sentences shared across the settlement reports can
 * otherwise return six passages that say the identical thing.
 */
export function diversityTable(rows: DiversityRow[]): string {
  return table(
    ['query', 'variant', 'mean pairwise cosine', 'distinct projects', 'results'],
    ['---', '---', '---:', '---:', '---:'],
    rows.map((entry) =>
      row([
        entry.query,
        entry.variant,
        entry.meanPairwiseCosine.toFixed(4),
        entry.distinctProjects,
        entry.results,
      ]),
    ),
  );
}
