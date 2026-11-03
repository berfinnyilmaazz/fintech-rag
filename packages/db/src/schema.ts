import { EMBEDDING_DIMENSIONS } from '@rag/shared';
import { sql } from 'drizzle-orm';
import {
  boolean,
  customType,
  index,
  integer,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
  vector,
} from 'drizzle-orm/pg-core';

/** Drizzle has no built-in tsvector type. */
const tsvector = customType<{ data: string }>({
  dataType: () => 'tsvector',
});

export const roleEnum = pgEnum('role', ['user', 'admin']);

export const docTypeEnum = pgEnum('doc_type', [
  'reference',
  'api-reference',
  'policy',
  'runbook',
  'release-note',
  'decision-record',
  'incident',
  'merchant-profile',
  'settlement-report',
]);

export const docStatusEnum = pgEnum('doc_status', ['current', 'deprecated']);
export const ingestStatusEnum = pgEnum('ingest_status', ['running', 'completed', 'failed']);
export const ingestTriggerEnum = pgEnum('ingest_trigger', ['cli', 'dashboard', 'watcher']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  role: roleEnum('role').notNull().default('user'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const documents = pgTable(
  'documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Always stored with forward slashes so the same corpus keys identically on every OS. */
    sourcePath: text('source_path').notNull().unique(),
    title: text('title').notNull(),
    docType: docTypeEnum('doc_type').notNull(),
    /** Extracted from the file path; the main thing separating near-identical reports. */
    project: text('project'),
    period: text('period'),
    /** Detected from content at ingestion; down-weights in ranking, never excludes. */
    status: docStatusEnum('status').notNull().default('current'),
    /** sha256 of newline-normalised content — drives incremental re-indexing. */
    contentHash: text('content_hash').notNull(),
    byteSize: integer('byte_size').notNull(),
    tokenCount: integer('token_count').notNull(),
    chunkCount: integer('chunk_count').notNull().default(0),
    embeddingModel: text('embedding_model').notNull(),
    /** Soft delete: the file vanished from disk but its search history stays meaningful. */
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    indexedAt: timestamp('indexed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('documents_project_idx').on(t.project),
    index('documents_doc_type_idx').on(t.docType),
  ],
);

export const chunks = pgTable(
  'chunks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    chunkIndex: integer('chunk_index').notNull(),
    /** The passage as written — this is what users are shown. */
    content: text('content').notNull(),
    /** content plus the metadata context prefix — this is what gets embedded. */
    embeddedText: text('embedded_text').notNull(),
    tokenCount: integer('token_count').notNull(),
    embedding: vector('embedding', { dimensions: EMBEDDING_DIMENSIONS }).notNull(),
    /**
     * Generated from embedded_text, not content, so doc_type, project, period and status
     * land in the keyword index. On this corpus the merchant slug and period are what
     * separate one settlement report from another.
     */
    tsv: tsvector('tsv').generatedAlwaysAs(sql`to_tsvector('english', embedded_text)`),
  },
  (t) => [
    index('chunks_embedding_idx').using('hnsw', t.embedding.op('vector_cosine_ops')),
    index('chunks_tsv_idx').using('gin', t.tsv),
    index('chunks_document_id_idx').on(t.documentId),
  ],
);

export const ingestionRuns = pgTable('ingestion_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  trigger: ingestTriggerEnum('trigger').notNull(),
  status: ingestStatusEnum('status').notNull().default('running'),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  docsAdded: integer('docs_added').notNull().default(0),
  docsUpdated: integer('docs_updated').notNull().default(0),
  docsSkipped: integer('docs_skipped').notNull().default(0),
  docsDeleted: integer('docs_deleted').notNull().default(0),
  chunksWritten: integer('chunks_written').notNull().default(0),
  errorMessage: text('error_message'),
});

export const searchLogs = pgTable(
  'search_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    query: text('query').notNull(),
    /** How the request was served: 'vector' | 'hybrid' for search, 'generative' | 'extractive' for chat. */
    mode: text('mode').notNull(),
    /**
     * Raw cosine similarity of the best vector hit — the same value the no-answer guard
     * thresholds on, so the dashboard and the guard agree. Not the fused RRF score, which
     * is rank-derived and near-constant. Null when nothing was retrieved.
     */
    topCosine: real('top_cosine'),
    resultCount: integer('result_count').notNull(),
    grounded: boolean('grounded').notNull(),
    latencyMs: integer('latency_ms').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('search_logs_created_at_idx').on(t.createdAt)],
);

export type UserRow = typeof users.$inferSelect;
export type DocumentRow = typeof documents.$inferSelect;
export type ChunkRow = typeof chunks.$inferSelect;
export type IngestionRunRow = typeof ingestionRuns.$inferSelect;
export type SearchLogRow = typeof searchLogs.$inferSelect;

export type NewUser = typeof users.$inferInsert;
export type NewDocument = typeof documents.$inferInsert;
export type NewChunk = typeof chunks.$inferInsert;
