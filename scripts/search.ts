import 'dotenv/config';
import { search } from '@rag/core';
import { closeDb } from '@rag/db';
import { SearchModeSchema } from '@rag/shared';

/**
 * Retrieval from the CLI.
 *
 *   pnpm run search "how do I create a payment with the current API?"
 *   pnpm run search --mode vector --top-k 10 "brindle market payout lag"
 *
 * Note `pnpm run` — plain `pnpm search` is a built-in pnpm command that queries the npm
 * registry. Passing several quoted questions runs each against one loaded model.
 */

function parseArgs(argv: string[]): { topK: number; mode: 'vector' | 'hybrid'; queries: string[] } {
  const queries: string[] = [];
  let topK = 5;
  let mode: 'vector' | 'hybrid' = 'hybrid';

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--top-k' || arg === '-k') {
      const value = Number(argv[++i]);
      if (!Number.isInteger(value) || value < 1)
        throw new Error('--top-k expects a positive integer');
      topK = value;
    } else if (arg === '--mode' || arg === '-m') {
      mode = SearchModeSchema.parse(argv[++i]);
    } else if (arg !== undefined) {
      queries.push(arg);
    }
  }

  return { topK, mode, queries };
}

const pad = (value: number | null, width: number): string =>
  (value === null ? '—' : String(value)).padStart(width);

const num = (value: number | null, digits = 4): string =>
  value === null ? '  —   ' : value.toFixed(digits);

function truncate(text: string, width: number): string {
  return text.length > width ? `${text.slice(0, width - 1)}…` : text.padEnd(width);
}

async function main(): Promise<void> {
  const { topK, mode, queries } = parseArgs(process.argv.slice(2));

  if (queries.length === 0) {
    console.error('Usage: pnpm run search [--mode vector|hybrid] [--top-k N] "your question"');
    process.exitCode = 1;
    return;
  }

  for (const query of queries) {
    const result = await search({ query, topK, mode });

    console.log(`\n"${query}"  [${result.mode}]`);
    console.log(
      `  ${result.chunks.length} results · topCosine ${num(result.topCosine)} · ` +
        `${result.latencyMs} ms (embed ${result.embedMs} + sql ${result.queryMs})\n`,
    );
    console.log('     vec   kw     score    cosine  status       source');
    console.log('    ----------------------------------------------------------------------------');

    for (const chunk of result.chunks) {
      const flag = chunk.status === 'deprecated' ? '⚠ deprecated' : '  current   ';
      console.log(
        `    ${pad(chunk.vectorRank, 3)}  ${pad(chunk.keywordRank, 3)}  ` +
          `${chunk.score.toFixed(6)}  ${num(chunk.cosine)}  ${flag}  ${truncate(chunk.sourcePath, 42)}`,
      );
    }
  }
}

main()
  .catch((error: unknown) => {
    console.error('\nSearch failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(closeDb);
