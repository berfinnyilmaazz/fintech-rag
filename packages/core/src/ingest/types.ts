import type { DocStatus, DocType } from '@rag/shared';

/** Metadata derived from a document's path and content, before chunking. */
export interface DocumentMetadata {
  docType: DocType;
  title: string;
  project: string | null;
  period: string | null;
  status: DocStatus;
}

export interface LoadedDocument extends DocumentMetadata {
  /** Relative to the corpus root, always forward-slashed, so it is identical on every OS. */
  sourcePath: string;
  /** Newline-normalised: every \r removed. */
  content: string;
  /** sha256 of `content`, which drives incremental re-indexing. */
  contentHash: string;
  /** Byte length of the normalised content, not the on-disk file. */
  byteSize: number;
  tokenCount: number;
}

export interface Chunk {
  index: number;
  content: string;
  tokenCount: number;
}
