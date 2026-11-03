-- Hand-added, and required: the vector(384) column below cannot be created without it.
-- drizzle-kit does not emit extension statements, so if migration 0000 is ever
-- regenerated this line has to be put back.
CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TYPE "public"."doc_status" AS ENUM('current', 'deprecated');--> statement-breakpoint
CREATE TYPE "public"."doc_type" AS ENUM('reference', 'api-reference', 'policy', 'runbook', 'release-note', 'decision-record', 'incident', 'merchant-profile', 'settlement-report');--> statement-breakpoint
CREATE TYPE "public"."ingest_status" AS ENUM('running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."ingest_trigger" AS ENUM('cli', 'dashboard', 'watcher');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TABLE "chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"embedded_text" text NOT NULL,
	"token_count" integer NOT NULL,
	"embedding" vector(384) NOT NULL,
	"tsv" "tsvector" GENERATED ALWAYS AS (to_tsvector('english', embedded_text)) STORED
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_path" text NOT NULL,
	"title" text NOT NULL,
	"doc_type" "doc_type" NOT NULL,
	"project" text,
	"period" text,
	"status" "doc_status" DEFAULT 'current' NOT NULL,
	"content_hash" text NOT NULL,
	"byte_size" integer NOT NULL,
	"token_count" integer NOT NULL,
	"chunk_count" integer DEFAULT 0 NOT NULL,
	"embedding_model" text NOT NULL,
	"deleted_at" timestamp with time zone,
	"indexed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_source_path_unique" UNIQUE("source_path")
);
--> statement-breakpoint
CREATE TABLE "ingestion_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trigger" "ingest_trigger" NOT NULL,
	"status" "ingest_status" DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"docs_added" integer DEFAULT 0 NOT NULL,
	"docs_updated" integer DEFAULT 0 NOT NULL,
	"docs_skipped" integer DEFAULT 0 NOT NULL,
	"docs_deleted" integer DEFAULT 0 NOT NULL,
	"chunks_written" integer DEFAULT 0 NOT NULL,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "search_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"query" text NOT NULL,
	"mode" text NOT NULL,
	"top_cosine" real,
	"result_count" integer NOT NULL,
	"grounded" boolean NOT NULL,
	"latency_ms" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"role" "role" DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_logs" ADD CONSTRAINT "search_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chunks_embedding_idx" ON "chunks" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "chunks_tsv_idx" ON "chunks" USING gin ("tsv");--> statement-breakpoint
CREATE INDEX "chunks_document_id_idx" ON "chunks" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "documents_project_idx" ON "documents" USING btree ("project");--> statement-breakpoint
CREATE INDEX "documents_doc_type_idx" ON "documents" USING btree ("doc_type");--> statement-breakpoint
CREATE INDEX "search_logs_created_at_idx" ON "search_logs" USING btree ("created_at");