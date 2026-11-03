import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** packages/core/src → repo root. */
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

/**
 * Resolves a corpus path against the repo root rather than `process.cwd()`.
 *
 * `CORPUS_PATH=./data/corpus` means the same directory whoever reads it, but cwd does not:
 * the CLI scripts run from the repo root while Next runs from `apps/web`, so a cwd-relative
 * resolve sent the dashboard's ingestion looking for `apps/web/data/corpus`. Absolute paths
 * are passed through untouched.
 */
export function resolveCorpusPath(input?: string | undefined): string {
  const candidate = input ?? process.env.CORPUS_PATH ?? './data/corpus';
  return isAbsolute(candidate) ? candidate : resolve(REPO_ROOT, candidate);
}
