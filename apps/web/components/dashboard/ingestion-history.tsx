'use client';

import type { IngestionRunSummary, IngestionRunsResponse } from '@rag/shared';
import { History } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { PanelCard } from '@/components/panel-card';
import { type Status, StatusBadge } from '@/components/status-badge';

const POLL_MS = 2000;

const STATUS: Record<IngestionRunSummary['status'], Status> = {
  running: 'running',
  completed: 'ok',
  failed: 'error',
};

function relative(iso: string): string {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function IngestionHistory({ initial }: { initial: IngestionRunSummary[] }) {
  const router = useRouter();
  const [runs, setRuns] = useState(initial);

  // Server-rendered data wins when the page re-renders, so a refresh elsewhere is not
  // overwritten by stale polled state.
  useEffect(() => setRuns(initial), [initial]);

  const active = runs.some((run) => run.status === 'running');

  /**
   * Polls only while something is running, and stops as soon as nothing is. A dashboard
   * that polls forever is a dashboard that keeps a laptop warm all afternoon.
   */
  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    const timer = setInterval(async () => {
      try {
        const response = await fetch('/api/ingest/runs?limit=5');
        if (!response.ok) return;

        const data = (await response.json()) as IngestionRunsResponse;
        if (cancelled) return;

        setRuns(data.runs);
        if (!data.runs.some((run) => run.status === 'running')) {
          // The run finished: pull fresh corpus counts rather than leaving stale numbers.
          router.refresh();
        }
      } catch (error: unknown) {
        console.error('Could not poll ingestion runs', error);
      }
    }, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [active, router]);

  return (
    <PanelCard title="Indexing history" aside={active ? 'running…' : undefined} bodyClassName="p-0">
      {runs.length === 0 ? (
        <EmptyState icon={History} title="No runs yet" description="Trigger one with Re-index." />
      ) : (
        <ul className="divide-y divide-border">
          {runs.map((run) => (
            <li key={run.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={STATUS[run.status]}>
                    {run.status === 'running'
                      ? 'Running'
                      : run.status === 'completed'
                        ? 'Completed'
                        : 'Failed'}
                  </StatusBadge>
                  <span className="font-mono text-[11px] text-ink-4">{run.trigger}</span>
                </div>
                <p className="mt-1.5 font-mono text-[11.5px] text-ink-3">
                  +{run.docsAdded} · ~{run.docsUpdated} · ={run.docsSkipped} · −{run.docsDeleted} ·{' '}
                  {run.chunksWritten} chunks
                </p>
                {run.errorMessage && (
                  <p className="mt-1 line-clamp-2 text-[11.5px] text-err">{run.errorMessage}</p>
                )}
              </div>
              <span className="shrink-0 font-mono text-[11px] text-ink-4">
                {relative(run.startedAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </PanelCard>
  );
}
