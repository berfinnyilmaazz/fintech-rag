import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { GoldenSetSchema, REPO_ROOT, search } from '@rag/core';
import { closeDb } from '@rag/db';

/**
 * Calibrates the no-answer threshold by measurement rather than by guessing.
 *
 * Prints `topCosine` — the best cosine similarity anywhere in the vector candidate pool —
 * for questions the corpus can answer and questions it cannot. The threshold belongs in the
 * gap between the two groups; if there is no gap, the threshold cannot do this job alone
 * and that has to be said out loud rather than papered over with a number that looks
 * plausible.
 */

const GOLDEN_PATH = resolve(REPO_ROOT, 'packages/core/eval/golden.json');

/** Golden-set questions, so the calibration and the eval measure the same thing. */
async function loadGolden(): Promise<{ answerable: string[]; outOfCorpus: string[] }> {
  const golden = GoldenSetSchema.parse(JSON.parse(await readFile(GOLDEN_PATH, 'utf8')));
  return {
    answerable: golden.questions.filter((q) => !q.shouldRefuse).map((q) => q.question),
    // In-domain vocabulary, but the corpus holds no answer.
    outOfCorpus: golden.questions.filter((q) => q.shouldRefuse).map((q) => q.question),
  };
}

/** Nothing to do with the domain at all — the floor the threshold can realistically catch. */
const UNRELATED: readonly string[] = [
  'What is the capital of France?',
  'How do I bake sourdough bread at home?',
  'Explain the offside rule in football.',
];

interface Measured {
  q: string;
  top: number;
  /** How far the best hit stands out from the rest of the pool. */
  margin: number;
  /** How many of the topK the keyword arm also found. */
  keywordHits: number;
}

async function measure(questions: readonly string[]): Promise<Measured[]> {
  const measured: Measured[] = [];
  for (const q of questions) {
    const { topCosine, chunks } = await search({ query: q, topK: 6 });
    const cosines = chunks.map((c) => c.cosine).filter((c): c is number => c !== null);
    const mean = cosines.reduce((sum, c) => sum + c, 0) / (cosines.length || 1);
    measured.push({
      q,
      top: topCosine ?? 0,
      margin: (topCosine ?? 0) - mean,
      keywordHits: chunks.filter((c) => c.keywordRank !== null).length,
    });
  }
  return measured;
}

function report(label: string, rows: Measured[]): void {
  console.log(`\n${label}\n`);
  console.log('  topCos  margin  kwHits  question');
  for (const { q, top, margin, keywordHits } of rows) {
    const text = q.length > 54 ? `${q.slice(0, 51)}...` : q;
    console.log(
      `  ${top.toFixed(4)}  ${margin.toFixed(4)}     ${String(keywordHits).padStart(2)}   ${text}`,
    );
  }
}

function spread(label: string, answerable: Measured[], out: Measured[], key: keyof Measured): void {
  const lo = Math.min(...answerable.map((r) => Number(r[key])));
  const hi = Math.max(...out.map((r) => Number(r[key])));
  const gap = lo - hi;
  console.log(
    `  ${label.padEnd(12)} lowest answerable ${lo.toFixed(4)} · highest out-of-corpus ${hi.toFixed(4)} · gap ${gap >= 0 ? '+' : ''}${gap.toFixed(4)}${gap > 0 ? '  ← separates' : '  ← overlaps'}`,
  );
}

async function main(): Promise<void> {
  const golden = await loadGolden();
  const answerable = await measure(golden.answerable);
  const outOfCorpus = await measure(golden.outOfCorpus);
  const unrelated = await measure(UNRELATED);

  report('ANSWERABLE — every answerable golden-set question', answerable);
  report('OUT OF CORPUS — in-domain wording, no answer in the corpus', outOfCorpus);
  report('UNRELATED — nothing to do with the domain', unrelated);

  const highestUnrelated = Math.max(...unrelated.map((r) => r.top));
  console.log(`\n  highest unrelated topCosine: ${highestUnrelated.toFixed(4)}`);

  console.log(`\n${'-'.repeat(88)}`);
  console.log('Can any single signal separate the two groups?\n');
  spread('topCosine', answerable, outOfCorpus, 'top');
  spread('margin', answerable, outOfCorpus, 'margin');
  spread('keywordHits', answerable, outOfCorpus, 'keywordHits');

  const lowestAnswerable = Math.min(...answerable.map((r) => r.top));
  const highestOutOfCorpus = Math.max(...outOfCorpus.map((r) => r.top));

  console.log('');
  if (lowestAnswerable > highestOutOfCorpus) {
    const midpoint = (lowestAnswerable + highestOutOfCorpus) / 2;
    console.log(`  topCosine separates cleanly. Threshold candidate: ${midpoint.toFixed(4)}`);
  } else {
    console.log('  topCosine OVERLAPS: out-of-corpus questions score above answerable ones.');
    console.log('  A single cosine threshold cannot carry this requirement on its own.');
    console.log(`  A threshold below ${lowestAnswerable.toFixed(4)} only catches far-out queries;`);
    console.log('  everything above it has to be refused by the model and the citation check.');
  }
}

main()
  .catch((error: unknown) => {
    console.error('\ncalibrate failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(closeDb);
