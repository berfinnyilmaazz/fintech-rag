'use client';

import { DocTypeSchema, type DocumentListResponse, type DocumentSummary } from '@rag/shared';
import { FileText, Trash2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { PanelCard } from '@/components/panel-card';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';

function shortDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 16).replace('T', ' ');
}

function DeleteButton({ document, onDone }: { document: DocumentSummary; onDone: () => void }) {
  const [busy, setBusy] = useState(false);

  async function remove() {
    // Deleting a document removes it from search. A confirm is the cheapest thing that
    // stops a misplaced click from silently shrinking the corpus.
    if (!window.confirm(`Remove ${document.sourcePath} from the index?`)) return;

    setBusy(true);
    try {
      const response = await fetch(`/api/documents/${document.id}`, { method: 'DELETE' });
      if (!response.ok) {
        const detail: unknown = await response.json().catch(() => null);
        console.error('Delete failed', response.status, detail);
        window.alert('Could not remove that document.');
        return;
      }
      onDone();
    } catch (error: unknown) {
      console.error('Delete failed', error);
      window.alert('Could not remove that document.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void remove()}
      disabled={busy}
      aria-label={`Remove ${document.sourcePath}`}
      className="rounded-sm p-1.5 text-ink-4 transition-colors hover:bg-err-soft hover:text-err disabled:opacity-50"
    >
      <Trash2 size={14} strokeWidth={1.5} />
    </button>
  );
}

export interface DocumentTableProps {
  data: DocumentListResponse;
  docType?: string;
  status?: string;
}

export function DocumentTable({ data, docType, status }: DocumentTableProps) {
  const router = useRouter();
  const params = useSearchParams();

  /** Filters and paging live in the URL, so the state is shareable and survives a refresh. */
  function navigate(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === '') next.delete(key);
      else next.set(key, value);
    }
    if (!('page' in patch)) next.delete('page');
    router.push(`/dashboard?${next.toString()}`);
  }

  const lastPage = Math.max(1, Math.ceil(data.total / data.pageSize));
  const from = data.total === 0 ? 0 : (data.page - 1) * data.pageSize + 1;
  const to = Math.min(data.total, data.page * data.pageSize);

  return (
    <PanelCard
      title="Documents"
      aside={`${from}–${to} of ${data.total}`}
      bodyClassName="p-0"
      className="min-w-0"
    >
      <div className="flex flex-wrap gap-2 border-border border-b px-4 py-2.5">
        <select
          value={docType ?? ''}
          onChange={(event) => navigate({ docType: event.target.value || null })}
          className="rounded-sm border border-border bg-surface px-2 py-1 text-[12px] text-ink-2"
        >
          <option value="">All types</option>
          {DocTypeSchema.options.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>

        <select
          value={status ?? ''}
          onChange={(event) => navigate({ status: event.target.value || null })}
          className="rounded-sm border border-border bg-surface px-2 py-1 text-[12px] text-ink-2"
        >
          <option value="">All statuses</option>
          <option value="current">current</option>
          <option value="deprecated">deprecated</option>
        </select>
      </div>

      {data.documents.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documents"
          description="No document matches these filters."
        />
      ) : (
        <>
          {/* Below 768px the table becomes a card list. A horizontally scrolling table on a
              phone is the usual shortcut and it hides the columns that matter most. */}
          <ul className="divide-y divide-border md:hidden">
            {data.documents.map((document) => (
              <li key={document.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-[13px] text-ink">{document.title}</p>
                  <p className="truncate font-mono text-[11.5px] text-ink-4">
                    {document.sourcePath}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <StatusBadge status={document.status === 'deprecated' ? 'deprecated' : 'ok'}>
                      {document.status === 'deprecated' ? 'deprecated' : 'indexed'}
                    </StatusBadge>
                    <span className="font-mono text-[11px] text-ink-4">
                      {document.docType} · {document.chunkCount} chunk
                    </span>
                  </div>
                </div>
                <DeleteButton document={document} onDone={() => router.refresh()} />
              </li>
            ))}
          </ul>

          <div className="hidden md:block">
            <Table>
              <THead>
                <TR>
                  <TH>Document</TH>
                  <TH>Type</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Chunks</TH>
                  <TH className="text-right">Indexed</TH>
                  <TH />
                </TR>
              </THead>
              <TBody>
                {data.documents.map((document) => (
                  <TR key={document.id}>
                    <TD className="max-w-[280px]">
                      <div className="truncate font-medium text-[12.5px] text-ink">
                        {document.title}
                      </div>
                      <div className="truncate font-mono text-[11.5px] text-ink-4">
                        {document.sourcePath}
                      </div>
                    </TD>
                    <TD className="font-mono text-[11.5px] text-ink-3">{document.docType}</TD>
                    <TD>
                      <StatusBadge status={document.status === 'deprecated' ? 'deprecated' : 'ok'}>
                        {document.status === 'deprecated' ? 'deprecated' : 'indexed'}
                      </StatusBadge>
                    </TD>
                    <TD className="text-right font-mono text-[11.5px] tabular-nums">
                      {document.chunkCount}
                    </TD>
                    <TD className="text-right font-mono text-[11.5px] text-ink-4 tabular-nums">
                      {shortDate(document.indexedAt)}
                    </TD>
                    <TD className="text-right">
                      <DeleteButton document={document} onDone={() => router.refresh()} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>

          <div className="flex items-center justify-between gap-3 border-border border-t px-4 py-2.5">
            <span className="font-mono text-[11.5px] text-ink-4">
              page {data.page} / {lastPage}
            </span>
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant="secondary"
                disabled={data.page <= 1}
                onClick={() => navigate({ page: String(data.page - 1) })}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={data.page >= lastPage}
                onClick={() => navigate({ page: String(data.page + 1) })}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </PanelCard>
  );
}
