import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  ask,
  cosineSimilarity,
  type DiversityRow,
  diversityTable,
  type EvalVariant,
  type GoldenQuestion,
  GoldenSetSchema,
  getEmbeddingProvider,
  type KeywordMode,
  type MeasuredSet,
  type Measurement,
  NO_ANSWER_COSINE_THRESHOLD,
  perQuestionTable,
  qualityTable,
  RANK_DEPTH,
  REPO_ROOT,
  refusalTable,
  search,
  supportingTable,
  toDocumentRanking,
} from '@rag/core';
import { closeDb } from '@rag/db';
import type { RetrievedChunk, SearchMode } from '@rag/shared';

/**
 * Measures retrieval quality across the golden set, one row per configuration.
 *
 * Every variant is scored against the same questions and the same index, so the tables it
 * prints are a comparison rather than a set of anecdotes. Losing variants stay in the
 * output: what was tried and rejected is as much of the record as what was kept.
 *
 *   pnpm eval              # full sweep, plus the end-to-end refusal check
 *   pnpm eval -- --no-llm  # retrieval only, no model calls
 */

const GOLDEN_PATH = resolve(REPO_ROOT, 'packages/core/eval/golden.json');

interface Variant extends EvalVariant {
  mode: SearchMode;
  keywordMode?: KeywordMode;
  mmr?: boolean;
  mmrLambda?: number;
  /** BGE's asymmetric query instruction. §9 of CLAUDE.md left this open for the eval. */
  prefix: boolean;
}

const VARIANTS: readonly Variant[] = [
  { id: 'vector', label: 'vector-only', mode: 'vector', mmr: false, prefix: true },
  {
    id: 'and',
    label: 'hybrid RRF · AND',
    mode: 'hybrid',
    keywordMode: 'and',
    mmr: false,
    prefix: true,
  },
  {
    id: 'or',
    label: 'hybrid RRF · OR',
    mode: 'hybrid',
    keywordMode: 'or',
    mmr: false,
    prefix: true,
  },
  {
    id: 'fallback',
    label: 'hybrid RRF · AND→OR',
    mode: 'hybrid',
    keywordMode: 'fallback',
    mmr: false,
    prefix: true,
  },
  {
    id: 'and+mmr',
    label: 'hybrid AND · MMR λ0.5',
    mode: 'hybrid',
    keywordMode: 'and',
    mmr: true,
    mmrLambda: 0.5,
    prefix: true,
  },
  {
    id: 'or+mmr',
    label: 'hybrid OR · MMR λ0.5',
    mode: 'hybrid',
    keywordMode: 'or',
    mmr: true,
    mmrLambda: 0.5,
    prefix: true,
  },
  {
    id: 'fallback+mmr.7',
    label: 'hybrid AND→OR · MMR λ0.7',
    mode: 'hybrid',
    keywordMode: 'fallback',
    mmr: true,
    mmrLambda: 0.7,
    prefix: true,
  },
  // λ0.7 turned out to be too weak to move anything in this embedding space, where related
  // documents sit at 0.85+ cosine of each other. Lower λ is measured rather than assumed.
  {
    id: 'fallback+mmr.5',
    label: 'hybrid AND→OR · MMR λ0.5  ← shipped',
    mode: 'hybrid',
    keywordMode: 'fallback',
    mmr: true,
    mmrLambda: 0.5,
    prefix: true,
  },
  {
    id: 'fallback+mmr.3',
    label: 'hybrid AND→OR · MMR λ0.3',
    mode: 'hybrid',
    keywordMode: 'fallback',
    mmr: true,
    mmrLambda: 0.3,
    prefix: true,
  },
  {
    id: 'and/no-prefix',
    label: 'hybrid AND · no query prefix',
    mode: 'hybrid',
    keywordMode: 'and',
    mmr: false,
    prefix: false,
  },
];

/**
 * Queries aimed straight at trap 2 — the settlement reports whose highlights are drawn from
 * a small pool of shared sentences. They are not in the golden set because each has dozens of equally
 * correct sources, which is exactly why recall cannot score them and why diversity is
 * measured separately.
 */
const REPETITIVE_QUERIES: readonly string[] = [
  'which months had the chargeback ratio below the monitoring threshold?',
  'payout lag after the ledgerd batch window moved',
  'do_not_honor soft declines recovered on retry',
  'risk-scorer review queue cleared within 24 hours',
];

async function runSearch(variant: Variant, question: string, topK: number) {
  // The unprefixed variant embeds the question the way a *document* is embedded, which is
  // exactly the comparison: same model, same text, one instruction removed.
  const queryVector = variant.prefix
    ? undefined
    : (await getEmbeddingProvider().embedDocuments([question]))[0];

  return search({
    query: question,
    topK,
    mode: variant.mode,
    keywordMode: variant.keywordMode,
    mmr: variant.mmr,
    mmrLambda: variant.mmrLambda,
    queryVector,
  });
}

async function measure(variant: Variant, question: GoldenQuestion): Promise<Measurement> {
  const result = await runSearch(variant, question.question, RANK_DEPTH);
  return {
    ranking: toDocumentRanking(result.chunks.map((chunk) => chunk.sourcePath)),
    topCosine: result.topCosine,
    latencyMs: result.latencyMs,
  };
}

async function diversityOf(
  chunks: RetrievedChunk[],
): Promise<Omit<DiversityRow, 'query' | 'variant'>> {
  const vectors = await getEmbeddingProvider().embedDocuments(chunks.map((chunk) => chunk.content));

  const pairs: number[] = [];
  for (let i = 0; i < vectors.length; i++) {
    for (let j = i + 1; j < vectors.length; j++) {
      const a = vectors[i];
      const b = vectors[j];
      if (a && b) pairs.push(cosineSimilarity(a, b));
    }
  }

  return {
    meanPairwiseCosine: pairs.length === 0 ? 0 : pairs.reduce((t, v) => t + v, 0) / pairs.length,
    // A reference document has no project, so it counts as its own path — the question is
    // how many different things came back, not how many settlement reports did.
    distinctProjects: new Set(chunks.map((chunk) => chunk.project ?? chunk.sourcePath)).size,
    results: chunks.length,
  };
}

/**
 * The cosine guard is only the first layer. This runs the full ask() path — retrieve, guard,
 * generate, validate citations — because a question that clears the threshold must still be
 * refused by the prompt and produce no citations.
 */
async function endToEndRefusals(questions: GoldenQuestion[]): Promise<string> {
  const rows: string[] = [
    '| question | top cosine | caught by | citations | answer |',
    '| --- | ---: | --- | ---: | --- |',
  ];

  for (const question of questions) {
    try {
      const result = await ask({ query: question.question, log: false });
      const cosine = result.topCosine;
      const layer =
        cosine !== null && cosine < NO_ANSWER_COSINE_THRESHOLD
          ? 'layer 1 — cosine guard'
          : 'layer 2 — prompt + citation validation';
      const answer = result.answer.replaceAll('\n', ' ').slice(0, 70);
      rows.push(
        `| ${question.question} | ${cosine === null ? '—' : cosine.toFixed(4)} | ${layer} | ` +
          `${result.citations.length} | "${answer}" |`,
      );
    } catch (error: unknown) {
      // A provider outage must not throw away the retrieval tables that already printed.
      // Gemini's free tier allows 20 generate_content calls per *day*, and a full eval run
      // spends three of them, so this is reachable in normal use.
      const reason = error instanceof Error ? error.message.split('\n')[0] : String(error);
      rows.push(`| ${question.question} | — | provider error | — | ${reason} |`);
    }
  }

  return rows.join('\n');
}

async function main(): Promise<void> {
  const golden = GoldenSetSchema.parse(JSON.parse(await readFile(GOLDEN_PATH, 'utf8')));
  const answerable = golden.questions.filter((question) => !question.shouldRefuse);
  const refusals = golden.questions.filter((question) => question.shouldRefuse);
  const samples = answerable.filter((question) => question.group === 'trap').length;

  console.log(
    `Golden set: ${answerable.length} answerable (${samples} trap questions) ` +
      `+ ${refusals.length} out-of-corpus\n`,
  );

  // Load the model before anything is timed, so the first variant does not absorb it.
  process.stdout.write('warming the embedding model… ');
  await getEmbeddingProvider().embedQuery('warmup');
  console.log('done');

  const results = new Map<string, MeasuredSet>();
  // Two passes, and only the second is kept. The first sweep's timings drift by 5× purely
  // from JIT and connection warm-up, which made the earliest variant in the list look slow
  // and the last look fast — an artefact of ordering, not a property of the variant.
  for (const pass of [0, 1]) {
    for (const variant of VARIANTS) {
      const measured = new Map<string, Measurement>();
      for (const question of golden.questions) {
        measured.set(question.id, await measure(variant, question));
      }
      if (pass === 1) results.set(variant.id, measured);
      console.log(
        `  ${pass === 0 ? 'warm ' : 'measure'} ${variant.id.padEnd(14)} ${golden.questions.length} questions`,
      );
    }
  }

  console.log('\n### Retrieval quality across the golden set\n');
  console.log(qualityTable(VARIANTS, answerable, results, NO_ANSWER_COSINE_THRESHOLD));

  const withSupport = answerable.filter((question) => question.supporting.length > 0).length;
  console.log(`\n### Supporting-document coverage (${withSupport} questions that have one)\n`);
  console.log(supportingTable(VARIANTS, answerable, results));

  console.log('\n### Rank of the expected document, per question\n');
  console.log(perQuestionTable(VARIANTS, answerable, results));

  console.log(
    `\n### Out-of-corpus questions — best cosine vs the ${NO_ANSWER_COSINE_THRESHOLD} guard\n`,
  );
  console.log(refusalTable(VARIANTS, refusals, results, NO_ANSWER_COSINE_THRESHOLD));

  console.log('\n### Result diversity on repetitive queries (topK 6)\n');
  const diversity: DiversityRow[] = [];
  for (const query of REPETITIVE_QUERIES) {
    for (const variant of VARIANTS.filter((v) => v.id.startsWith('fallback'))) {
      const { chunks } = await runSearch(variant, query, 6);
      diversity.push({ query, variant: variant.id, ...(await diversityOf(chunks)) });
    }
  }
  console.log(diversityTable(diversity));

  if (!process.argv.includes('--no-llm')) {
    console.log('\n### End-to-end refusal behaviour (default configuration)\n');
    console.log(await endToEndRefusals(refusals));
  }
}

main()
  .catch((error: unknown) => {
    console.error('\neval failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(closeDb);
