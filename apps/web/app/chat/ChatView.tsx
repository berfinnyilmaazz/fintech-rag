'use client';

import type { ChatEvent, Citation, RetrievedChunk } from '@rag/shared';
import { AlertCircle, ArrowUp, Check, FileSearch, Info } from 'lucide-react';
import { type FormEvent, Fragment, useCallback, useRef, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { SourceCard } from '@/components/source-card';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const EXAMPLE_QUESTIONS = [
  'How do I create a payment with the current Payments API, and what happened to /v1/charges?',
  'Why were payouts duplicated in April 2026, and what changed to prevent it?',
  'What happens if a buyer opens a dispute on a payment that was already refunded?',
];

type Phase = 'retrieving' | 'streaming' | 'done' | 'error';

interface Turn {
  id: string;
  question: string;
  phase: Phase;
  text: string;
  citations: Citation[];
  passages: RetrievedChunk[];
  grounded: boolean;
  mode: 'generative' | 'extractive';
  topCosine: number | null;
  threshold: number;
  latencyMs: number;
  retrievalMs: number;
  error?: string;
}

function newTurn(question: string): Turn {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    question,
    phase: 'retrieving',
    text: '',
    citations: [],
    passages: [],
    grounded: false,
    mode: 'generative',
    topCosine: null,
    threshold: 0,
    latencyMs: 0,
    retrievalMs: 0,
  };
}

/**
 * Renders `[n]` markers as citation chips. The markers survive validation server-side, so
 * anything still in the text resolves to a real passage — the lookup below cannot invent one.
 */
function AnswerProse({
  text,
  citations,
  onCite,
  streaming,
}: {
  text: string;
  citations: Citation[];
  onCite: (index: number) => void;
  streaming: boolean;
}) {
  const known = new Set(citations.map((c) => c.index));

  /**
   * Positional keys are correct here and not a shortcut: this text grows a token at a time,
   * so every segment's identity *is* its position. Content-derived keys would collide on
   * repeated words and churn on every keystroke of the stream.
   */
  const paragraphs = text
    .split(/\n{2,}/)
    // A list whose items are separated by single newlines would otherwise collapse into one
    // paragraph, which is what a whole answer rendered as a single bullet looks like.
    .flatMap((block) => (/^\s*[*-]\s+/m.test(block) ? block.split('\n') : [block]))
    // A heading followed by a single newline would otherwise swallow the paragraph under it.
    .flatMap((block) =>
      /^\s*#{1,6}\s+/m.test(block) ? block.split(/\n(?=\s*#)|(?<=^\s*#.*)\n/m) : [block],
    )
    // A thematic break carries no content worth a line of its own.
    .filter((paragraph) => paragraph.trim() !== '' && !/^\s*([-*_])\1{2,}\s*$/.test(paragraph))
    .map((paragraph, pIndex) => ({
      key: `p${pIndex}`,
      last: false,
      // The model writes markdown whether or not it was asked to, and which markers it
      // reaches for varies by model. Rather than fight the prompt, the ones that actually
      // appear are rendered: headings, bullets, `code`, **strong** and *emphasis*.
      heading: /^\s*#{1,6}\s+/.test(paragraph),
      bullet: /^\s*[*-]\s+/.test(paragraph),
      segments: paragraph
        .replace(/^\s*#{1,6}\s+/, '')
        .replace(/^\s*[*-]\s+/gm, '')
        // Order matters: **strong** has to be tried before *emphasis*, or the outer pair
        // is consumed one asterisk at a time and the marker leaks into the text.
        .split(/(\[\d+\]|`[^`]+`|\*\*[^*]+\*\*|\*[^*\n]+\*)/)
        .map((part, sIndex) => {
          const cited = /^\[(\d+)\]$/.exec(part);
          const code = /^`([^`]+)`$/.exec(part);
          const strong = /^\*\*([^*]+)\*\*$/.exec(part);
          const emphasis = /^\*([^*\n]+)\*$/.exec(part);
          return {
            key: `p${pIndex}s${sIndex}`,
            text: code?.[1] ?? strong?.[1] ?? emphasis?.[1] ?? part,
            code: code !== null,
            strong: strong !== null,
            emphasis: emphasis !== null,
            cite: cited?.[1] === undefined ? null : Number(cited[1]),
          };
        }),
    }));

  const lastParagraph = paragraphs.at(-1);
  if (lastParagraph) lastParagraph.last = true;

  return (
    <div className="prose-answer max-w-[760px]">
      {paragraphs.map((paragraph, index) => (
        <p
          key={paragraph.key}
          className={cn(
            index > 0 && 'mt-3.5',
            paragraph.heading && 'font-medium text-ink',
            paragraph.bullet &&
              'relative pl-4 before:absolute before:left-1 before:text-ink-4 before:content-["·"]',
          )}
        >
          {paragraph.segments.map((segment) => {
            if (segment.code) {
              return (
                <code
                  key={segment.key}
                  className="rounded-sm bg-surface-2 px-1 py-0.5 font-mono text-[13px] text-ink"
                >
                  {segment.text}
                </code>
              );
            }
            if (segment.strong) {
              // Models often bold an identifier: **`amount`**. Render the code, not its fences.
              const inner = /^`([^`]+)`$/.exec(segment.text);
              return (
                <strong key={segment.key} className="font-medium text-ink">
                  {inner ? (
                    <code className="rounded-sm bg-surface-2 px-1 py-0.5 font-mono text-[13px]">
                      {inner[1]}
                    </code>
                  ) : (
                    segment.text
                  )}
                </strong>
              );
            }
            if (segment.emphasis) {
              return (
                <em key={segment.key} className="italic">
                  {segment.text}
                </em>
              );
            }
            if (segment.cite === null) return <Fragment key={segment.key}>{segment.text}</Fragment>;
            if (!known.has(segment.cite)) return null;

            const cite = segment.cite;
            return (
              <sup key={segment.key} className="ml-0.5">
                <button
                  type="button"
                  onClick={() => onCite(cite)}
                  className="inline-flex size-[15px] items-center justify-center rounded-full bg-accent-soft font-medium text-[10px] text-accent tabular-nums transition-colors hover:bg-accent hover:text-white"
                  aria-label={`Jump to source ${cite}`}
                >
                  {cite}
                </button>
              </sup>
            );
          })}
          {streaming && paragraph.last && <span className="caret" />}
        </p>
      ))}
      {paragraphs.length === 0 && streaming && <span className="caret" />}
    </div>
  );
}

function MetricLine({ turn }: { turn: Turn }) {
  const parts: string[] = [];

  if (turn.passages.length === 0) {
    // The refusal path. Showing the threshold next to the score is what makes the guard
    // legible instead of magic.
    parts.push(`topCosine ${turn.topCosine?.toFixed(4) ?? '—'}`);
    parts.push(`threshold ${turn.threshold.toFixed(2)}`);
    parts.push('model not called');
  } else {
    parts.push(`retrieval ${turn.retrievalMs} ms`);
    parts.push(`generation ${Math.max(0, turn.latencyMs - turn.retrievalMs)} ms`);
    parts.push(turn.mode === 'generative' ? 'hybrid · RRF k=60' : 'hybrid · extractive');
  }

  return <p className="mt-3 font-mono text-[11.5px] text-ink-4">{parts.join('  ·  ')}</p>;
}

export function ChatView() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const update = useCallback((id: string, patch: Partial<Turn>) => {
    setTurns((current) => current.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const submit = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (trimmed === '' || busy) return;

      const turn = newTurn(trimmed);
      setTurns((current) => [...current, turn]);
      setInput('');
      setBusy(true);
      requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }));

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: trimmed, topK: 6 }),
        });

        if (!response.ok || !response.body) {
          const detail: unknown = await response.json().catch(() => null);
          console.error('Chat request failed', response.status, detail);
          update(turn.id, {
            phase: 'error',
            error:
              response.status === 429
                ? 'Too many questions in a short time. Wait a moment and try again.'
                : 'The request failed. Check the console for details.',
          });
          return;
        }

        // NDJSON: the server sends one JSON object per line. useChat cannot be used here
        // because the terminal event carries citations the model never produced.
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let text = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (line.trim() === '') continue;

            let event: ChatEvent;
            try {
              event = JSON.parse(line) as ChatEvent;
            } catch {
              console.error('Unparseable stream line', line);
              continue;
            }

            if (event.type === 'token') {
              text += event.value;
              update(turn.id, { phase: 'streaming', text });
            } else if (event.type === 'done') {
              update(turn.id, {
                phase: 'done',
                text: event.answer,
                citations: event.citations,
                passages: event.passages,
                grounded: event.grounded,
                mode: event.mode,
                topCosine: event.topCosine,
                threshold: event.threshold,
                latencyMs: event.latencyMs,
                retrievalMs: event.retrievalMs,
              });
            } else {
              console.error('Chat stream error', event.code, event.message);
              update(turn.id, { phase: 'error', error: event.message });
            }
          }
        }
      } catch (error: unknown) {
        console.error('Chat stream failed', error);
        update(turn.id, {
          phase: 'error',
          error: 'The connection dropped before the answer finished.',
        });
      } finally {
        setBusy(false);
        requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }));
      }
    },
    [busy, update],
  );

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit(input);
  }

  function jumpToSource(turnId: string, index: number) {
    const id = `${turnId}-source-${index}`;
    setHighlighted(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 px-5 py-6 nav:px-8">
        <div className="mx-auto w-full max-w-[760px]">
          {turns.length === 0 ? (
            <div className="pt-8">
              <EmptyState
                icon={FileSearch}
                title="Ask the corpus"
                description="Internal documentation of Vantor, a fictional payments company — API references, policies, runbooks, release notes, incident reviews and settlement reports. Answers cite the documents they came from."
              />
              <div className="mt-4 flex flex-col gap-2">
                {EXAMPLE_QUESTIONS.map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => void submit(question)}
                    className="rounded-md border border-border bg-surface px-3 py-2.5 text-left text-[13px] text-ink-2 transition-colors hover:border-border-strong hover:bg-surface-2"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-8">
              {turns.map((turn) => (
                <Turn key={turn.id} turn={turn} highlighted={highlighted} onCite={jumpToSource} />
              ))}
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="sticky bottom-0 border-border border-t bg-bg/90 px-5 py-4 backdrop-blur nav:px-8">
        <form onSubmit={onSubmit} className="mx-auto flex w-full max-w-[760px] items-end gap-2">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void submit(input);
              }
            }}
            rows={1}
            placeholder="Ask about the corpus…"
            className="max-h-40 min-h-10 flex-1 resize-none rounded-md border border-border-strong bg-surface px-3 py-2.5 text-[13.5px] text-ink placeholder:text-ink-4 focus:border-accent-line focus:outline-none"
          />
          <Button
            type="submit"
            disabled={busy || input.trim() === ''}
            className="size-10 shrink-0 px-0"
          >
            <ArrowUp size={16} strokeWidth={1.5} />
            <span className="sr-only">Send</span>
          </Button>
        </form>
        {turns.length > 0 && (
          <div className="mx-auto mt-2 flex w-full max-w-[760px] flex-wrap gap-1.5">
            {EXAMPLE_QUESTIONS.map((question) => (
              <button
                key={question}
                type="button"
                disabled={busy}
                onClick={() => void submit(question)}
                className="truncate rounded-full border border-border bg-surface px-2.5 py-1 text-[11.5px] text-ink-3 transition-colors hover:bg-surface-2 disabled:opacity-50"
                style={{ maxWidth: '15rem' }}
              >
                {question}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Turn({
  turn,
  highlighted,
  onCite,
}: {
  turn: Turn;
  highlighted: string | null;
  onCite: (turnId: string, index: number) => void;
}) {
  const maxScore = turn.passages[0]?.score ?? 1;
  const refused = turn.phase === 'done' && turn.passages.length === 0;
  const extractive = turn.phase === 'done' && turn.mode === 'extractive';

  return (
    <article className="flex flex-col">
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-md border border-border bg-surface-2 px-3 py-2 text-[13.5px] text-ink">
          {turn.question}
        </p>
      </div>

      <div className="mt-5">
        <div className="mb-2 text-[11px] text-ink-4 uppercase tracking-[0.07em]">Answer</div>

        {turn.phase === 'retrieving' && (
          <div className="flex items-center gap-2 text-[13px] text-ink-3">
            <span className="size-1.5 animate-pulse rounded-full bg-ink-4" />
            Searching the corpus…
          </div>
        )}

        {turn.phase === 'error' && (
          <div className="flex items-start gap-2 rounded-md border border-err/20 bg-err-soft px-3 py-2.5 text-[13px] text-err">
            <AlertCircle size={16} strokeWidth={1.5} className="mt-px shrink-0" />
            <span>{turn.error}</span>
          </div>
        )}

        {(turn.phase === 'streaming' || turn.phase === 'done') && (
          <>
            {extractive ? (
              <div className="rounded-md border border-info/20 bg-info-soft p-4">
                <div className="flex items-center gap-2 font-medium text-[12.5px] text-info">
                  <Info size={16} strokeWidth={1.5} />
                  Retrieved passages · no answer generated
                </div>
                <p className="mt-1.5 max-w-[640px] text-[12.5px] text-ink-3 leading-relaxed">
                  No answer model is configured, so these are the passages the search found rather
                  than a written answer. Nothing here has been checked against the question — the
                  corpus may not answer it at all.
                </p>
              </div>
            ) : (
              <AnswerProse
                text={turn.text}
                citations={turn.citations}
                streaming={turn.phase === 'streaming'}
                onCite={(index) => onCite(turn.id, index)}
              />
            )}

            {turn.phase === 'done' && (
              <>
                <div className="mt-4">
                  {refused ? (
                    <StatusBadge status="deprecated">
                      <Info size={14} strokeWidth={1.5} />
                      Not enough relevant sources — no answer generated
                    </StatusBadge>
                  ) : turn.grounded ? (
                    <StatusBadge status="ok">
                      <Check size={14} strokeWidth={1.5} />
                      Verified from {turn.citations.length}{' '}
                      {turn.citations.length === 1 ? 'source' : 'sources'}
                    </StatusBadge>
                  ) : null}
                </div>

                <MetricLine turn={turn} />

                {turn.passages.length > 0 && (
                  <section className="mt-4 rounded-md border border-border bg-surface-2/40 p-3">
                    <header className="mb-2.5 flex items-baseline justify-between gap-3">
                      <h3
                        data-sources
                        className="text-[11px] text-ink-4 uppercase tracking-[0.07em]"
                      >
                        Sources
                      </h3>
                      <span className="font-mono text-[11px] text-ink-4">
                        {turn.passages.length} retrieved · {turn.citations.length} cited
                      </span>
                    </header>
                    <div className="flex flex-col gap-2">
                      {turn.passages.map((passage, index) => {
                        const id = `${turn.id}-source-${index + 1}`;
                        return (
                          <SourceCard
                            key={passage.chunkId}
                            id={id}
                            index={index + 1}
                            chunk={passage}
                            maxScore={maxScore}
                            highlighted={highlighted === id}
                          />
                        );
                      })}
                    </div>
                  </section>
                )}
              </>
            )}
          </>
        )}
      </div>
    </article>
  );
}
