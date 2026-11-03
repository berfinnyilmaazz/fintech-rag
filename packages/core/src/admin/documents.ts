import { chunks, type Db, db as defaultDb, documents, ingestionRuns } from '@rag/db';
import type { DocumentListResponse, DocumentQuery, DocumentSummary } from '@rag/shared';
import { and, count, desc, eq, isNull, type SQL } from 'drizzle-orm';

/**
 * Corpus queries for the dashboard. They live in core rather than in a route handler so the
 * SQL is testable, reusable and not duplicated the moment a second surface needs it.
 */

function toSummary(row: typeof documents.$inferSelect): DocumentSummary {
  return {
    id: row.id,
    sourcePath: row.sourcePath,
    title: row.title,
    docType: row.docType,
    project: row.project,
    period: row.period,
    status: row.status,
    tokenCount: row.tokenCount,
    chunkCount: row.chunkCount,
    byteSize: row.byteSize,
    embeddingModel: row.embeddingModel,
    indexedAt: row.indexedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}

export async function listDocuments(
  query: DocumentQuery,
  database: Db = defaultDb,
): Promise<DocumentListResponse> {
  const filters: SQL[] = [];
  if (!query.includeDeleted) filters.push(isNull(documents.deletedAt));
  if (query.docType) filters.push(eq(documents.docType, query.docType));
  if (query.project) filters.push(eq(documents.project, query.project));
  if (query.status) filters.push(eq(documents.status, query.status));

  const where = filters.length > 0 ? and(...filters) : undefined;

  // Counted separately rather than inferred from the page, so the client can show a real
  // total alongside a partial page.
  const [totals] = await database.select({ value: count() }).from(documents).where(where);

  const rows = await database
    .select()
    .from(documents)
    .where(where)
    .orderBy(documents.sourcePath)
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize);

  return {
    documents: rows.map(toSummary),
    total: totals?.value ?? 0,
    page: query.page,
    pageSize: query.pageSize,
  };
}

export interface SoftDeleteResult {
  id: string;
  sourcePath: string;
  chunksRemoved: number;
}

/**
 * Soft-deletes a document and removes its chunks, in one transaction.
 *
 * The row survives so search history and ingestion counts stay meaningful; the chunks do
 * not, because a document that is no longer part of the corpus must not be retrievable.
 * Returns null when the id does not exist or was already deleted, which the route turns
 * into a 404 — deleting twice should not report success the second time.
 */
export async function softDeleteDocument(
  id: string,
  database: Db = defaultDb,
): Promise<SoftDeleteResult | null> {
  return database.transaction(async (tx) => {
    const [document] = await tx
      .select({ id: documents.id, sourcePath: documents.sourcePath })
      .from(documents)
      .where(and(eq(documents.id, id), isNull(documents.deletedAt)))
      .limit(1);

    if (!document) return null;

    const removed = await tx
      .delete(chunks)
      .where(eq(chunks.documentId, document.id))
      .returning({ id: chunks.id });

    await tx
      .update(documents)
      .set({ deletedAt: new Date(), chunkCount: 0 })
      .where(eq(documents.id, document.id));

    return {
      id: document.id,
      sourcePath: document.sourcePath,
      chunksRemoved: removed.length,
    };
  });
}

export async function listIngestionRuns(limit: number, database: Db = defaultDb) {
  const rows = await database
    .select()
    .from(ingestionRuns)
    .orderBy(desc(ingestionRuns.startedAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    trigger: row.trigger,
    status: row.status,
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
    docsAdded: row.docsAdded,
    docsUpdated: row.docsUpdated,
    docsSkipped: row.docsSkipped,
    docsDeleted: row.docsDeleted,
    chunksWritten: row.chunksWritten,
    errorMessage: row.errorMessage,
  }));
}
