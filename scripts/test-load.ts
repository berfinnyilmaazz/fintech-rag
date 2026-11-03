import 'dotenv/config';
import { resolve } from 'node:path';
import { buildEmbeddedText, chunkDocument, loadCorpus } from '@rag/core';
import type { DocType } from '@rag/shared';

/**
 * Runs the loader and chunker over the real corpus and checks the result against what the
 * corpus is known to contain. Exits non-zero on any mismatch, so this is a check rather
 * than a report.
 */

const CORPUS_PATH = resolve(process.env.CORPUS_PATH ?? './data/corpus');

const EXPECTED_DOC_TYPES: Readonly<Record<DocType, number>> = {
  reference: 3,
  'api-reference': 9,
  policy: 7,
  runbook: 7,
  'release-note': 10,
  'decision-record': 8,
  incident: 5,
  'merchant-profile': 8,
  'settlement-report': 66,
};

const EXPECTED_TOTAL = 123;
const EXPECTED_PROJECTS = 8;

const failures: string[] = [];
function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}: ${JSON.stringify(actual)}`);
  if (!ok) failures.push(`${label} — expected ${JSON.stringify(expected)}`);
}

async function main(): Promise<void> {
  const documents = await loadCorpus(CORPUS_PATH);
  console.log(`loaded ${documents.length} documents from ${CORPUS_PATH}\n`);

  // (a) docType distribution
  console.log('--- (a) docType distribution ---\n');
  const byType = new Map<string, number>();
  for (const doc of documents) {
    byType.set(doc.docType, (byType.get(doc.docType) ?? 0) + 1);
  }
  for (const [docType, expected] of Object.entries(EXPECTED_DOC_TYPES)) {
    check(docType.padEnd(18), byType.get(docType) ?? 0, expected);
  }
  check('total'.padEnd(18), documents.length, EXPECTED_TOTAL);

  // (b) deprecation detection
  console.log('\n--- (b) documents detected as deprecated ---\n');
  const deprecated = documents.filter((doc) => doc.status === 'deprecated');
  for (const doc of deprecated) {
    console.log(`  ${doc.sourcePath}  (${doc.title})`);
  }
  check(
    'deprecated paths',
    deprecated.map((d) => d.sourcePath),
    ['api/payments-api-v1.md'],
  );

  // (c) project extraction
  console.log('\n--- (c) project slugs ---\n');
  const withProject = documents.filter((doc) => doc.project !== null);
  const slugs = [...new Set(withProject.map((doc) => doc.project))].sort();
  console.log(`  documents with a project: ${withProject.length}`);
  console.log(`  distinct slugs          : ${slugs.join(', ')}`);
  check('distinct project count', slugs.length, EXPECTED_PROJECTS);
  // Incidents and release notes share the settlement reports' filename shape, but their
  // slug is not a merchant, so none of them may claim a project.
  check(
    'incidents / release notes with a project',
    documents.filter(
      (d) => (d.docType === 'incident' || d.docType === 'release-note') && d.project !== null,
    ).length,
    0,
  );

  // (d) chunking
  console.log('\n--- (d) chunking ---\n');
  const chunkCounts = documents.map((doc) => chunkDocument(doc.content).length);
  const totalChunks = chunkCounts.reduce((sum, n) => sum + n, 0);
  const largest = documents.reduce((max, doc) => (doc.tokenCount > max.tokenCount ? doc : max));
  console.log(`  largest document: ${largest.sourcePath} (${largest.tokenCount} tokens)`);
  check('total chunks', totalChunks, EXPECTED_TOTAL);
  check('documents split into more than one chunk', chunkCounts.filter((n) => n > 1).length, 0);

  // (e) path normalisation
  console.log('\n--- (e) sourcePath samples ---\n');
  for (const doc of [documents[0], documents[20], documents[100], documents.at(-1)]) {
    if (doc) console.log(`  ${doc.sourcePath}`);
  }
  check(
    'paths containing a backslash',
    documents.filter((doc) => doc.sourcePath.includes('\\')).length,
    0,
  );

  // (f) what actually gets embedded
  console.log('\n--- (f) buildEmbeddedText for one settlement report ---\n');
  const sample =
    documents.find((doc) => doc.sourcePath === 'settlement-reports/2026-05-brindle-market.md') ??
    documents.find((doc) => doc.docType === 'settlement-report');
  if (!sample) throw new Error('no settlement report found in the corpus');

  const [chunk] = chunkDocument(sample.content);
  if (!chunk) throw new Error('chunker returned nothing');

  console.log(`  source: ${sample.sourcePath}`);
  console.log(
    `  hash  : ${sample.contentHash.slice(0, 16)}…  bytes: ${sample.byteSize}  tokens: ${sample.tokenCount}\n`,
  );
  console.log('  ┌─────────────────────────────────────────────────────────────────────');
  for (const line of buildEmbeddedText(sample, chunk.content).split('\n')) {
    console.log(`  │ ${line}`);
  }
  console.log('  └─────────────────────────────────────────────────────────────────────');

  if (failures.length > 0) {
    console.error(`\n${failures.length} check(s) failed:`);
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exitCode = 1;
    return;
  }
  console.log('\nAll checks passed.');
}

main().catch((error: unknown) => {
  console.error('\ntest-load failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
