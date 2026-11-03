'use client';

import type { RetrievedChunk } from '@rag/shared';
import { cn } from '@/lib/utils';
import { ScoreBar } from './score-bar';

export interface SourceCardProps {
  /** The [n] the answer cites. */
  index: number;
  chunk: RetrievedChunk;
  /** Highest score in the result set, so the rails are comparable to each other. */
  maxScore: number;
  /** Set when the reader clicked this citation. */
  highlighted?: boolean;
  id?: string;
}

/**
 * One retrieved passage. The number badge is the link between the answer's `[n]` and the
 * source, so it carries the accent — and turns warn for a deprecated document, because the
 * reader needs to see *before* reading the passage that it is superseded.
 */
export function SourceCard({ index, chunk, maxScore, highlighted, id }: SourceCardProps) {
  const deprecated = chunk.status === 'deprecated';

  return (
    <article
      id={id}
      className={cn(
        'flex gap-3 rounded-md border p-3 transition-colors',
        highlighted ? 'border-accent-line bg-accent-soft' : 'border-border bg-surface',
      )}
    >
      <span
        className={cn(
          'mt-px flex size-5 shrink-0 items-center justify-center rounded-full font-medium text-[11px] tabular-nums',
          deprecated ? 'bg-warn-soft text-warn' : 'bg-accent-soft text-accent',
        )}
      >
        {index}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <h3 className="font-medium text-[13px] text-ink">{chunk.title}</h3>
          <span className="truncate font-mono text-[11.5px] text-ink-4">{chunk.sourcePath}</span>
          {deprecated && (
            <span className="rounded-sm bg-warn-soft px-1.5 py-0.5 font-medium text-[10.5px] text-warn leading-none">
              deprecated
            </span>
          )}
        </div>

        {/* Two lines: enough to recognise the passage, not enough to substitute for it. */}
        <p className="mt-1.5 line-clamp-2 text-[12.5px] text-ink-3 leading-relaxed">
          {chunk.content.replace(/^#.*$/m, '').trim()}
        </p>
      </div>

      <ScoreBar
        value={chunk.score}
        max={maxScore}
        tone={deprecated ? 'warn' : 'accent'}
        digits={chunk.score < 0.1 ? 4 : 3}
        className="mt-0.5 shrink-0 self-start"
      />
    </article>
  );
}
