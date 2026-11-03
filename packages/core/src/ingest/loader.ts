import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join, sep } from 'node:path';
import type { DocType } from '@rag/shared';
import { countTokens } from './tokens';
import type { DocumentMetadata, LoadedDocument } from './types';

const DIR_TO_DOC_TYPE: Readonly<Record<string, DocType>> = {
  api: 'api-reference',
  policies: 'policy',
  runbooks: 'runbook',
  'release-notes': 'release-note',
  decisions: 'decision-record',
  incidents: 'incident',
  merchants: 'merchant-profile',
  'settlement-reports': 'settlement-report',
};

/** "2026-05-brindle-market" — a month-dated file; the trailing text may be a merchant. */
const MONTH_DATED = /^(\d{4})-(\d{2})-(.+)$/;

/**
 * "deprecated since", "superseded by", or a standalone DEPRECATED.
 *
 * Deliberately not /supersede/: a current document saying "v2 supersedes v1" would otherwise
 * be marked deprecated — the exact inversion of trap 1. There is a test pinning this.
 */
const DEPRECATION_MARKER = /\bDEPRECATED\b|deprecated since|superseded by/i;

/** Windows hands back backslashes; metadata must not depend on which OS ran the ingest. */
export function toPosixPath(path: string): string {
  return path.split(sep).join('/');
}

/**
 * Strips carriage returns before anything hashes or measures the content. A CRLF checkout
 * would otherwise hash differently from an LF one, and every file would look "changed" on
 * the next incremental run.
 */
export function normaliseContent(raw: string): string {
  return raw.replace(/\r/g, '');
}

export function hashContent(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

export function extractMetadata(sourcePath: string, content: string): DocumentMetadata {
  const segments = sourcePath.split('/');
  const fileName = segments.at(-1) ?? '';
  const directory = segments.length > 1 ? (segments.at(-2) ?? '') : '';
  const stem = fileName.replace(/\.md$/, '');

  const docType = DIR_TO_DOC_TYPE[directory] ?? 'reference';
  const title = content.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? stem;

  let period: string | null = null;
  let project: string | null = null;

  const monthDated = MONTH_DATED.exec(stem);
  if (monthDated) {
    period = `${monthDated[1]}-${monthDated[2]}`;
    // Only settlement reports name a merchant after the date. Incidents and release notes
    // share the YYYY-MM-slug shape, but "duplicate-payouts" or "api-2.4" is not a merchant,
    // and admitting it would pollute the field whose whole job is to identify merchants.
    if (docType === 'settlement-report') {
      project = monthDated[3] ?? null;
    }
  } else if (docType === 'merchant-profile') {
    // Merchant profiles are named after the merchant and carry no date.
    project = stem;
  }

  const status = DEPRECATION_MARKER.test(content) ? 'deprecated' : 'current';

  return { docType, title, project, period, status };
}

export async function loadDocument(
  corpusRoot: string,
  absolutePath: string,
): Promise<LoadedDocument> {
  const content = normaliseContent(await readFile(absolutePath, 'utf8'));
  const sourcePath = toPosixPath(absolutePath.slice(corpusRoot.length + 1));

  return {
    sourcePath,
    ...extractMetadata(sourcePath, content),
    content,
    contentHash: hashContent(content),
    byteSize: Buffer.byteLength(content, 'utf8'),
    tokenCount: countTokens(content),
  };
}

/** Walks the corpus recursively. Results are sorted so runs are reproducible. */
export async function loadCorpus(corpusRoot: string): Promise<LoadedDocument[]> {
  const entries = await readdir(corpusRoot, { recursive: true, withFileTypes: true });
  const markdown = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.md'));

  const documents = await Promise.all(
    markdown.map((entry) => loadDocument(corpusRoot, join(entry.parentPath, entry.name))),
  );

  return documents.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));
}
