import { describe, expect, it } from 'vitest';
// Imported from './plan', not './pipeline': the pipeline pulls in the Drizzle client, which
// validates DATABASE_URL at import time, and these tests touch no database at all.
import { type ExistingDocument, planWork } from './plan';
import type { LoadedDocument } from './types';

function onDisk(sourcePath: string, contentHash: string): LoadedDocument {
  return {
    sourcePath,
    contentHash,
    docType: 'reference',
    title: sourcePath,
    project: null,
    period: null,
    status: 'current',
    content: 'body',
    byteSize: 4,
    tokenCount: 1,
  };
}

function inDatabase(
  sourcePath: string,
  contentHash: string,
  deletedAt: Date | null = null,
): ExistingDocument {
  return { id: `id-${sourcePath}`, sourcePath, contentHash, deletedAt };
}

describe('planWork', () => {
  it('adds a document the database has never seen', () => {
    const plan = planWork([onDisk('new.md', 'hash-a')], []);

    expect(plan.toWrite).toHaveLength(1);
    expect(plan.toWrite[0]?.action).toBe('add');
    expect(plan.skipped).toBe(0);
    expect(plan.toDelete).toHaveLength(0);
  });

  it('skips a document whose hash is unchanged', () => {
    // This is the path that makes re-running cheap: no chunking, no embedding, no write.
    const plan = planWork([onDisk('same.md', 'hash-a')], [inDatabase('same.md', 'hash-a')]);

    expect(plan.skipped).toBe(1);
    expect(plan.toWrite).toHaveLength(0);
  });

  it('updates a document whose hash changed', () => {
    const plan = planWork([onDisk('edited.md', 'hash-b')], [inDatabase('edited.md', 'hash-a')]);

    expect(plan.toWrite).toHaveLength(1);
    expect(plan.toWrite[0]?.action).toBe('update');
    expect(plan.toWrite[0]?.existingId).toBe('id-edited.md');
    expect(plan.skipped).toBe(0);
  });

  it('re-indexes a soft-deleted document that came back, even with a matching hash', () => {
    // Soft deletion removes the chunks but leaves the row and its hash. Trusting the hash
    // here would mark the file "skipped" and leave it in the index with zero chunks —
    // present in the dashboard, invisible to search.
    const plan = planWork(
      [onDisk('restored.md', 'hash-a')],
      [inDatabase('restored.md', 'hash-a', new Date('2026-08-01'))],
    );

    expect(plan.skipped).toBe(0);
    expect(plan.toWrite).toHaveLength(1);
    expect(plan.toWrite[0]?.action).toBe('update');
  });

  it('soft-deletes a document that is no longer on disk', () => {
    const plan = planWork(
      [onDisk('kept.md', 'hash-a')],
      [inDatabase('kept.md', 'hash-a'), inDatabase('gone.md', 'hash-b')],
    );

    expect(plan.toDelete.map((row) => row.sourcePath)).toEqual(['gone.md']);
    expect(plan.skipped).toBe(1);
  });

  it('does not delete an already soft-deleted document twice', () => {
    const plan = planWork([], [inDatabase('gone.md', 'hash-b', new Date('2026-08-01'))]);

    expect(plan.toDelete).toHaveLength(0);
  });

  it('classifies a mixed corpus in one pass', () => {
    const plan = planWork(
      [onDisk('a.md', 'h1'), onDisk('b.md', 'h2-new'), onDisk('c.md', 'h3')],
      [inDatabase('a.md', 'h1'), inDatabase('b.md', 'h2-old'), inDatabase('d.md', 'h4')],
    );

    expect(plan.skipped).toBe(1);
    expect(plan.toWrite.map((w) => [w.document.sourcePath, w.action])).toEqual([
      ['b.md', 'update'],
      ['c.md', 'add'],
    ]);
    expect(plan.toDelete.map((row) => row.sourcePath)).toEqual(['d.md']);
  });
});
