import { countTokens, decodeTokens, encodeTokens } from './tokens';
import type { Chunk, DocumentMetadata } from './types';

/**
 * Documents at or below this stay whole. Measured decision, not a default: the largest
 * document in this corpus is about 220 tokens, so splitting would fragment context that is
 * already coherent and make retrieval worse. The splitter below exists so the pipeline
 * still behaves correctly when pointed at a corpus that does need it — on this one it
 * never fires.
 */
export const MAX_CHUNK_TOKENS = 512;
export const TARGET_CHUNK_TOKENS = 400;
export const CHUNK_OVERLAP_TOKENS = 60;

export interface ChunkOptions {
  maxTokens?: number;
  target?: number;
  overlap?: number;
}

/** Splits at markdown headings, keeping each heading with the prose beneath it. */
function splitIntoSections(content: string): string[] {
  const sections: string[] = [];
  let current: string[] = [];

  for (const line of content.split('\n')) {
    if (/^#{1,6}\s/.test(line) && current.length > 0) {
      sections.push(current.join('\n'));
      current = [];
    }
    current.push(line);
  }
  if (current.length > 0) sections.push(current.join('\n'));

  return sections;
}

/** Greedily merges consecutive sections while they fit inside `target`. */
function packSections(sections: string[], target: number): string[] {
  const packed: string[] = [];
  let current = '';

  for (const section of sections) {
    if (current === '') {
      current = section;
      continue;
    }
    const merged = `${current}\n${section}`;
    if (countTokens(merged) <= target) {
      current = merged;
    } else {
      packed.push(current);
      current = section;
    }
  }
  if (current !== '') packed.push(current);

  return packed;
}

/** Last resort for a single section larger than `target`: split on token boundaries. */
function splitOversized(text: string, target: number): string[] {
  const tokens = encodeTokens(text);
  if (tokens.length <= target) return [text];

  const parts: string[] = [];
  for (let start = 0; start < tokens.length; start += target) {
    parts.push(decodeTokens(tokens.slice(start, start + target)));
  }
  return parts;
}

/**
 * Prepends the tail of the previous *emitted* chunk to each chunk, so a claim spanning a
 * boundary survives in at least one piece. Carrying the tail from the emitted chunk rather
 * than the raw part makes the overlap exact: chunk[i] starts with precisely the last
 * `overlap` tokens of chunk[i - 1].
 */
function applyOverlap(parts: string[], overlap: number): string[] {
  if (overlap <= 0 || parts.length < 2) return parts;

  const withOverlap: string[] = [];
  for (const [index, part] of parts.entries()) {
    const previous = withOverlap[index - 1];
    if (previous === undefined) {
      withOverlap.push(part);
      continue;
    }
    const tail = decodeTokens(encodeTokens(previous).slice(-overlap));
    withOverlap.push(`${tail}\n${part}`);
  }
  return withOverlap;
}

export function chunkDocument(content: string, options: ChunkOptions = {}): Chunk[] {
  const maxTokens = options.maxTokens ?? MAX_CHUNK_TOKENS;
  const target = options.target ?? TARGET_CHUNK_TOKENS;
  const overlap = options.overlap ?? CHUNK_OVERLAP_TOKENS;

  const total = countTokens(content);
  if (total <= maxTokens) {
    return [{ index: 0, content, tokenCount: total }];
  }

  const packed = packSections(splitIntoSections(content), target).flatMap((section) =>
    splitOversized(section, target),
  );

  return applyOverlap(packed, overlap).map((text, index) => ({
    index,
    content: text,
    tokenCount: countTokens(text),
  }));
}

/**
 * The text that gets embedded. The metadata header is the main thing distinguishing
 * settlement reports whose bodies are drawn from the same small pool of sentences, and it
 * is also what puts merchant slugs, periods and status into the keyword index (chunks.tsv is generated
 * from this column, not from `content`).
 *
 * `content` — what the user is shown — deliberately does not carry the header.
 */
export function buildEmbeddedText(metadata: DocumentMetadata, chunkContent: string): string {
  return [
    `[${metadata.docType}] ${metadata.title}`,
    `project: ${metadata.project ?? '-'} | period: ${metadata.period ?? '-'} | status: ${metadata.status}`,
    '',
    chunkContent,
  ].join('\n');
}
