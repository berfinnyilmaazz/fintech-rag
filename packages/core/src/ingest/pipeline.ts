import {
  chunks as chunksTable,
  type Db,
  db as defaultDb,
  documents,
  type IngestionRunRow,
  ingestionRuns,
  type NewChunk,
} from '@rag/db';
import { eq, inArray, isNull } from 'drizzle-orm';
import {
  assertEmbeddingDimensions,
  type EmbeddingProvider,
  getEmbeddingProvider,
} from '../embeddings/index';
import { buildEmbeddedText, chunkDocument } from './chunker';
import { loadCorpus } from './loader';
import { type Action, planWork } from './plan';

export type IngestionTrigger = IngestionRunRow['trigger'];

/**
 * Documents whose chunks are embedded together before being written. The provider batches
 * at 32 texts internally; grouping documents on top of that keeps one embedding call
 * covering several documents while still reporting progress often enough that a 30-second
 * run does not look hung.
 */
const DOCUMENT_BATCH = 16;

export interface IngestionProgress {
  processed: number;
  total: number;
  sourcePath: string;
  action: Action;
}

export interface IngestionOptions {
  corpusPath: string;
  trigger: IngestionTrigger;
  db?: Db;
  embeddings?: EmbeddingProvider;
  onProgress?: (progress: IngestionProgress) => void;
  /**
   * Adopts a run row that already exists instead of opening one.
   *
   * The dashboard endpoint has to return a run id before the work starts — a full re-index
   * measured 37 s and cannot be held open on an HTTP request — so it inserts the row, hands
   * the id back, and lets the pipeline fill it in from the background.
   */
  runId?: string;
}

export interface IngestionResult {
  runId: string;
  status: 'completed' | 'failed';
  docsAdded: number;
  docsUpdated: number;
  docsSkipped: number;
  docsDeleted: number;
  chunksWritten: number;
  durationMs: number;
  errorMessage: string | null;
}

export async function runIngestion(options: IngestionOptions): Promise<IngestionResult> {
  const database = options.db ?? defaultDb;
  const embeddings = options.embeddings ?? getEmbeddingProvider();
  assertEmbeddingDimensions(embeddings);

  const startedAt = performance.now();

  const run = options.runId
    ? { id: options.runId }
    : (
        await database
          .insert(ingestionRuns)
          .values({ trigger: options.trigger })
          .returning({ id: ingestionRuns.id })
      )[0];
  if (!run) throw new Error('Could not open an ingestion run');

  let docsAdded = 0;
  let docsUpdated = 0;
  let docsSkipped = 0;
  let docsDeleted = 0;
  let chunksWritten = 0;
  let errorMessage: string | null = null;

  try {
    const loaded = await loadCorpus(options.corpusPath);
    const existing = await database
      .select({
        id: documents.id,
        sourcePath: documents.sourcePath,
        contentHash: documents.contentHash,
        deletedAt: documents.deletedAt,
      })
      .from(documents);

    const plan = planWork(loaded, existing);
    docsSkipped = plan.skipped;

    let processed = plan.skipped;
    const total = loaded.length;

    for (let start = 0; start < plan.toWrite.length; start += DOCUMENT_BATCH) {
      const batch = plan.toWrite.slice(start, start + DOCUMENT_BATCH);

      // Chunk everything in the batch, then embed all of its chunks in one call.
      const prepared = batch.map(({ document, action, existingId }) => {
        const pieces = chunkDocument(document.content);
        return {
          document,
          action,
          existingId,
          pieces,
          embeddedTexts: pieces.map((piece) => buildEmbeddedText(document, piece.content)),
        };
      });

      const vectors = await embeddings.embedDocuments(prepared.flatMap((p) => p.embeddedTexts));

      let cursor = 0;
      for (const item of prepared) {
        const rows: Array<Omit<NewChunk, 'documentId'>> = item.pieces.map((piece, index) => {
          const embedding = vectors[cursor + index];
          if (!embedding) throw new Error(`Missing embedding for ${item.document.sourcePath}`);
          return {
            chunkIndex: piece.index,
            content: piece.content,
            embeddedText: item.embeddedTexts[index] ?? '',
            tokenCount: piece.tokenCount,
            embedding,
          };
        });
        cursor += item.pieces.length;

        // One transaction per document: a document and its chunks are always consistent
        // with each other. Partial progress across documents is fine and in fact useful —
        // the next run picks up where this one stopped, because the hashes say so.
        await database.transaction(async (tx) => {
          const values = {
            sourcePath: item.document.sourcePath,
            title: item.document.title,
            docType: item.document.docType,
            project: item.document.project,
            period: item.document.period,
            status: item.document.status,
            contentHash: item.document.contentHash,
            byteSize: item.document.byteSize,
            tokenCount: item.document.tokenCount,
            chunkCount: item.pieces.length,
            embeddingModel: embeddings.id,
            deletedAt: null,
            indexedAt: new Date(),
          };

          const [saved] = await tx
            .insert(documents)
            .values(values)
            .onConflictDoUpdate({ target: documents.sourcePath, set: values })
            .returning({ id: documents.id });
          if (!saved) throw new Error(`Could not upsert ${item.document.sourcePath}`);

          await tx.delete(chunksTable).where(eq(chunksTable.documentId, saved.id));
          if (rows.length > 0) {
            await tx
              .insert(chunksTable)
              .values(rows.map((row) => ({ ...row, documentId: saved.id })));
          }
        });

        if (item.action === 'add') docsAdded++;
        else docsUpdated++;
        chunksWritten += item.pieces.length;

        processed++;
        options.onProgress?.({
          processed,
          total,
          sourcePath: item.document.sourcePath,
          action: item.action,
        });
      }
    }

    if (plan.toDelete.length > 0) {
      const ids = plan.toDelete.map((row) => row.id);
      await database.transaction(async (tx) => {
        await tx.delete(chunksTable).where(inArray(chunksTable.documentId, ids));
        await tx.update(documents).set({ deletedAt: new Date() }).where(inArray(documents.id, ids));
      });
      docsDeleted = ids.length;
    }
  } catch (error: unknown) {
    errorMessage = error instanceof Error ? error.message : String(error);
  } finally {
    // Never leave a run stuck on 'running' — the dashboard reads this table.
    await database
      .update(ingestionRuns)
      .set({
        status: errorMessage === null ? 'completed' : 'failed',
        finishedAt: new Date(),
        docsAdded,
        docsUpdated,
        docsSkipped,
        docsDeleted,
        chunksWritten,
        errorMessage,
      })
      .where(eq(ingestionRuns.id, run.id));
  }

  return {
    runId: run.id,
    status: errorMessage === null ? 'completed' : 'failed',
    docsAdded,
    docsUpdated,
    docsSkipped,
    docsDeleted,
    chunksWritten,
    durationMs: Math.round(performance.now() - startedAt),
    errorMessage,
  };
}

/** Documents currently in the index — soft-deleted ones excluded. */
export async function listIndexedDocuments(database: Db = defaultDb) {
  return database
    .select()
    .from(documents)
    .where(isNull(documents.deletedAt))
    .orderBy(documents.sourcePath);
}
