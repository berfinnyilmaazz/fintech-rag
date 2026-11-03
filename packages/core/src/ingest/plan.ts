import type { LoadedDocument } from './types';

/**
 * The incremental decision, kept in its own module with no database import.
 *
 * `planWork` is a pure function of (files on disk, rows in the index), and separating it
 * from the pipeline that executes the plan is not tidiness: `pipeline.ts` imports the
 * Drizzle client, `@rag/db` validates DATABASE_URL when it is first imported, and that made
 * a unit test of pure classification logic fail on a fresh clone with no `.env`. A test for
 * a function that touches no database should not need one to be configured.
 */

export type Action = 'add' | 'update' | 'skip';

export interface ExistingDocument {
  id: string;
  sourcePath: string;
  contentHash: string;
  deletedAt: Date | null;
}

export interface Plan {
  toWrite: Array<{
    document: LoadedDocument;
    action: Exclude<Action, 'skip'>;
    existingId: string | null;
  }>;
  skipped: number;
  toDelete: Array<{ id: string; sourcePath: string }>;
}

/**
 * Decides what each document on disk needs, purely from hashes — no database and no
 * embedding calls. Exported so the classification can be tested directly; it is the whole
 * of the incremental behaviour.
 */
export function planWork(loaded: LoadedDocument[], existing: ExistingDocument[]): Plan {
  const byPath = new Map(existing.map((row) => [row.sourcePath, row]));
  const onDisk = new Set(loaded.map((doc) => doc.sourcePath));

  const toWrite: Plan['toWrite'] = [];
  let skipped = 0;

  for (const document of loaded) {
    const previous = byPath.get(document.sourcePath);

    if (!previous) {
      toWrite.push({ document, action: 'add', existingId: null });
    } else if (previous.deletedAt !== null) {
      // The file came back. Its chunks were removed when it was soft-deleted, so it has to
      // be re-indexed even though the hash may still match what is on the row.
      toWrite.push({ document, action: 'update', existingId: previous.id });
    } else if (previous.contentHash !== document.contentHash) {
      toWrite.push({ document, action: 'update', existingId: previous.id });
    } else {
      skipped++;
    }
  }

  const toDelete = existing
    .filter((row) => row.deletedAt === null && !onDisk.has(row.sourcePath))
    .map((row) => ({ id: row.id, sourcePath: row.sourcePath }));

  return { toWrite, skipped, toDelete };
}
