import 'dotenv/config';
import { resolveCorpusPath, runIngestion } from '@rag/core';
import { closeDb } from '@rag/db';

/**
 * Indexes the corpus. Re-running is cheap: documents whose content hash is unchanged are
 * skipped without touching the embedding model at all.
 *
 *   pnpm ingest                 # uses CORPUS_PATH, or ./data/corpus
 *   pnpm ingest ./data/corpus
 */

const corpusPath = resolveCorpusPath(process.argv[2]);

async function main(): Promise<void> {
  console.log(`Indexing ${corpusPath}\n`);
  const startedAt = performance.now();

  const result = await runIngestion({
    corpusPath,
    trigger: 'cli',
    onProgress: ({ processed, total, sourcePath, action }) => {
      const counter = `${String(processed).padStart(String(total).length)}/${total}`;
      console.log(`  ${counter}  ${action.padEnd(6)} ${sourcePath}`);
    },
  });

  const elapsed = ((performance.now() - startedAt) / 1000).toFixed(1);

  console.log('');
  console.table({
    added: result.docsAdded,
    updated: result.docsUpdated,
    skipped: result.docsSkipped,
    deleted: result.docsDeleted,
    'chunks written': result.chunksWritten,
  });
  console.log(`run ${result.runId} — ${result.status} in ${elapsed}s`);

  if (result.status === 'failed') {
    console.error(`\nIngestion failed: ${result.errorMessage}`);
    process.exitCode = 1;
  }
}

main()
  .catch((error: unknown) => {
    console.error('\nIngestion failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(closeDb);
