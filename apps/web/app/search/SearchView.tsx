'use client';

import type { SearchMode, SearchResponse } from '@rag/shared';
import { AlertCircle, Search } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { SourceCard } from '@/components/source-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const EXAMPLES = ['Idempotency-Key', 'brindle market chargeback ratio', 'E4091'];

/**
 * Raw retrieval with no model in the loop.
 *
 * This is where retrieval quality can be judged directly — scores, both arm ranks and the
 * metadata that separates otherwise-identical documents — without an API key and without a
 * generated answer sitting in front of the evidence.
 */
export function SearchView() {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('hybrid');
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(next: string, nextMode: SearchMode) {
    const trimmed = next.trim();
    if (trimmed === '' || busy) return;

    setBusy(true);
    setError(null);

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmed, mode: nextMode, topK: 10 }),
      });

      if (!response.ok) {
        const detail: unknown = await response.json().catch(() => null);
        console.error('Search failed', response.status, detail);
        setError(
          response.status === 429
            ? 'Too many searches in a short time. Wait a moment and try again.'
            : 'The search failed. Check the console for details.',
        );
        return;
      }

      setResult((await response.json()) as SearchResponse);
    } catch (caught: unknown) {
      console.error('Search failed', caught);
      setError('The request could not be completed.');
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(query, mode);
  }

  function switchMode(next: SearchMode) {
    setMode(next);
    // Re-running on switch is the point: the whole value of this page is the comparison.
    if (result) void run(query, next);
  }

  const maxScore = result?.chunks[0]?.score ?? 1;

  return (
    <div className="px-5 py-6 nav:px-8">
      <div className="mx-auto w-full max-w-[860px]">
        <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-2">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search the corpus…"
            className="min-w-[200px] flex-1"
          />

          <div className="flex overflow-hidden rounded-md border border-border-strong">
            {(['vector', 'hybrid'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => switchMode(option)}
                className={cn(
                  'px-3 py-2 text-[12.5px] capitalize transition-colors',
                  mode === option
                    ? 'bg-accent-soft font-medium text-accent'
                    : 'bg-surface text-ink-3 hover:bg-surface-2',
                )}
              >
                {option}
              </button>
            ))}
          </div>

          <Button type="submit" disabled={busy || query.trim() === ''}>
            {busy ? 'Searching…' : 'Search'}
          </Button>
        </form>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              disabled={busy}
              onClick={() => {
                setQuery(example);
                void run(example, mode);
              }}
              className="rounded-full border border-border bg-surface px-2.5 py-1 font-mono text-[11.5px] text-ink-3 transition-colors hover:bg-surface-2 disabled:opacity-50"
            >
              {example}
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-err/20 bg-err-soft px-3 py-2.5 text-[13px] text-err">
            <AlertCircle size={16} strokeWidth={1.5} className="mt-px shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {result && !error && (
          <>
            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 border-border border-b pb-2.5 font-mono text-[11.5px] text-ink-4">
              <span>{result.chunks.length} chunks</span>
              <span>topCosine {result.topCosine?.toFixed(4) ?? '—'}</span>
              <span>{result.latencyMs} ms</span>
              {/* Named because the recency tie-break can reorder the fused list on "latest"
                  questions: without this the score column reads as non-monotonic for no
                  visible reason. Mirrors DEFAULT_RECENCY and DEFAULT_MMR in packages/core —
                  client components cannot import core. */}
              <span>
                {result.mode === 'hybrid' ? 'hybrid · RRF k=60 · recency' : 'vector only'}
              </span>
            </div>

            {result.chunks.length === 0 ? (
              <EmptyState
                icon={Search}
                title="No matches"
                description="Nothing in the corpus scored highly enough for this query."
              />
            ) : (
              <div className="mt-3 flex flex-col gap-2">
                {result.chunks.map((chunk, index) => (
                  <div key={chunk.chunkId}>
                    <SourceCard index={index + 1} chunk={chunk} maxScore={maxScore} />
                    {/* The rank pair is the argument for hybrid: a document both arms
                        found scores roughly double one only the vector arm saw. */}
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 pl-8 font-mono text-[11px] text-ink-4">
                      <span>vec {chunk.vectorRank ?? '—'}</span>
                      <span>kw {chunk.keywordRank ?? '—'}</span>
                      <span>{chunk.docType}</span>
                      {chunk.project && <span>project {chunk.project}</span>}
                      {chunk.period && <span>period {chunk.period}</span>}
                      <span>cos {chunk.cosine?.toFixed(4) ?? '—'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {!result && !error && (
          <div className="mt-6">
            <EmptyState
              icon={Search}
              title="Raw retrieval"
              description="Search the corpus without generating an answer. Scores, both arm ranks and the metadata behind each result are shown, so retrieval can be judged on its own."
            />
          </div>
        )}
      </div>
    </div>
  );
}
