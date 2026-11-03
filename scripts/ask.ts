import 'dotenv/config';
import { ask, getLlmProvider } from '@rag/core';
import { closeDb } from '@rag/db';

/**
 * Grounded answers from the CLI, streaming as they arrive.
 *
 *   pnpm ask "how do I create a payment with the current API?"
 *   LLM_PROVIDER=none pnpm ask "…"     # forces extractive mode
 *
 * Several quoted questions run in turn against one loaded model.
 */

function parseArgs(argv: string[]): { topK: number; queries: string[] } {
  const queries: string[] = [];
  let topK = 6;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--top-k' || arg === '-k') {
      const value = Number(argv[++i]);
      if (!Number.isInteger(value) || value < 1) {
        throw new Error('--top-k expects a positive integer');
      }
      topK = value;
    } else if (arg !== undefined) {
      queries.push(arg);
    }
  }

  return { topK, queries };
}

async function main(): Promise<void> {
  const { topK, queries } = parseArgs(process.argv.slice(2));

  if (queries.length === 0) {
    console.error('Usage: pnpm ask [--top-k N] "your question"');
    process.exitCode = 1;
    return;
  }

  const provider = getLlmProvider();
  console.log(`provider: ${provider.id} (${provider.mode})`);

  for (const query of queries) {
    console.log(`\n${'='.repeat(84)}`);
    console.log(`Q: ${query}\n`);

    let streamed = false;
    const result = await ask({
      query,
      topK,
      llm: provider,
      onToken: (token) => {
        streamed = true;
        process.stdout.write(token);
      },
    });
    if (streamed) process.stdout.write('\n');

    console.log(
      `\n  grounded: ${result.grounded} · mode: ${result.mode} · ` +
        `topCosine: ${result.topCosine?.toFixed(4) ?? 'n/a'} · ` +
        `passages: ${result.passages.length} · ${result.latencyMs} ms`,
    );

    if (result.citations.length === 0) {
      console.log('  citations: none');
    } else {
      console.log('  citations:');
      for (const citation of result.citations) {
        console.log(`    [${citation.index}] ${citation.sourcePath}`);
      }
    }
  }
}

main()
  .catch((error: unknown) => {
    console.error('\nAsk failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(closeDb);
