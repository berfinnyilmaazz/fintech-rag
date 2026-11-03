import { getStats, listDocuments, listIngestionRuns } from '@rag/core';
import { DocumentQuerySchema } from '@rag/shared';
import { MessageSquareOff, TrendingUp } from 'lucide-react';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { DocumentTable } from '@/components/dashboard/document-table';
import { IngestionHistory } from '@/components/dashboard/ingestion-history';
import { ReindexButton } from '@/components/dashboard/reindex-button';
import { EmptyState } from '@/components/empty-state';
import { PanelCard } from '@/components/panel-card';
import { currentUser } from '@/lib/guards';

export const metadata = { title: 'Dashboard · Fintech RAG' };

function percent(value: number | null): string {
  return value === null ? '—' : `${Math.round(value * 100)}%`;
}

function seconds(ms: number | null): string {
  return ms === null ? '—' : `${(ms / 1000).toFixed(1)}s`;
}

/** Four figures in one card divided by rules, rather than four separate cards. */
function KpiStrip({ items }: { items: Array<{ label: string; value: string; hint: string }> }) {
  return (
    <div className="grid grid-cols-2 rounded-md border border-border bg-surface nav:grid-cols-4">
      {items.map((item, index) => (
        <div
          key={item.label}
          className={[
            'px-4 py-3.5',
            index % 2 === 1 ? 'border-border border-l nav:border-l' : '',
            index >= 2 ? 'border-border border-t nav:border-t-0' : '',
            index === 2 ? 'nav:border-border nav:border-l' : '',
          ].join(' ')}
        >
          <div className="text-[11px] text-ink-4 uppercase tracking-[0.07em]">{item.label}</div>
          <div className="mt-1.5 font-light text-[30px] text-ink leading-none tabular-nums">
            {item.value}
          </div>
          <div className="mt-1.5 text-[11.5px] text-ink-4">{item.hint}</div>
        </div>
      ))}
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // The proxy gates this route too, but a Server Component rendering admin data must not
  // depend on that having run. Nothing below this line executes for a non-admin, so no
  // admin-only field is ever serialised into the client payload.
  const user = await currentUser();
  if (!user) redirect('/signin?callbackUrl=/dashboard');
  if (user.role !== 'admin') redirect('/?denied=dashboard');

  const raw = await searchParams;
  const query = DocumentQuerySchema.parse({
    page: raw.page,
    pageSize: '15',
    docType: raw.docType,
    status: raw.status,
  });

  const [stats, documents, runs] = await Promise.all([
    getStats(),
    listDocuments(query),
    listIngestionRuns(5),
  ]);

  const maxTop = stats.search.topQueries[0]?.count ?? 1;

  return (
    <AppShell user={user} active="/dashboard">
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="flex flex-wrap items-start justify-between gap-3 border-border border-b bg-surface px-5 py-3 nav:px-8">
          <div>
            <h1 className="font-medium text-[15px] text-ink tracking-tight">Overview</h1>
            <p className="mt-0.5 font-mono text-[11.5px] text-ink-4">
              data/corpus · bge-small-en-v1.5 · 384 dimensions
            </p>
          </div>
          <ReindexButton />
        </header>

        <div className="flex flex-col gap-4 px-5 py-5 nav:px-8">
          <KpiStrip
            items={[
              {
                label: 'Documents',
                value: String(stats.corpus.documents),
                hint: `${stats.corpus.chunks} chunks · ${stats.corpus.deprecated} deprecated`,
              },
              {
                label: 'Tokens',
                value: stats.corpus.tokens.toLocaleString('en-US'),
                hint: 'across the indexed corpus',
              },
              {
                label: 'Avg answer',
                value: seconds(stats.search.avgLatencyMs),
                hint: `${stats.search.totalQueries} questions asked`,
              },
              {
                label: 'Unanswered',
                value: percent(stats.search.refusalRate),
                hint: 'corpus did not cover it',
              },
            ]}
          />

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <DocumentTable data={documents} docType={query.docType} status={query.status} />

            <div className="flex flex-col gap-4">
              <IngestionHistory initial={runs} />

              <PanelCard title="Top questions" bodyClassName="p-0">
                {stats.search.topQueries.length === 0 ? (
                  <EmptyState icon={TrendingUp} title="Nothing asked yet" />
                ) : (
                  <ul className="divide-y divide-border">
                    {stats.search.topQueries.slice(0, 6).map((entry) => (
                      <li key={entry.query} className="px-4 py-2.5">
                        <p className="truncate text-[12.5px] text-ink-2">{entry.query}</p>
                        <div className="mt-1.5 flex items-center gap-2">
                          <span className="h-[3px] flex-1 overflow-hidden rounded-full bg-surface-2">
                            <span
                              className="block h-full rounded-full bg-accent"
                              style={{ width: `${(entry.count / maxTop) * 100}%` }}
                            />
                          </span>
                          <span className="font-mono text-[11px] text-ink-4 tabular-nums">
                            {entry.count}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </PanelCard>

              <PanelCard
                title="Where the corpus falls short"
                aside={`${percent(stats.search.refusalRate)} of queries`}
                bodyClassName="p-0"
              >
                <p className="px-4 pt-3 text-[11.5px] text-ink-4 leading-relaxed">
                  The share of questions answered with &ldquo;the corpus does not cover this&rdquo;.
                  The most direct signal of what the corpus is missing, and the number a second
                  ingestion pass should move.
                </p>
                <dl className="mt-2 divide-y divide-border border-border border-t">
                  <div className="flex items-center justify-between gap-3 px-4 py-2">
                    <dt className="text-[12.5px] text-ink-3">Refusal rate</dt>
                    <dd className="font-mono text-[12px] text-ink tabular-nums">
                      {percent(stats.search.refusalRate)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 px-4 py-2">
                    <dt className="text-[12.5px] text-ink-3">Grounded rate</dt>
                    <dd className="font-mono text-[12px] text-ink tabular-nums">
                      {percent(stats.search.groundedRate)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 px-4 py-2">
                    <dt className="text-[12.5px] text-ink-3">Avg top cosine</dt>
                    <dd className="font-mono text-[12px] text-ink tabular-nums">
                      {stats.search.avgTopCosine?.toFixed(4) ?? '—'}
                    </dd>
                  </div>
                </dl>
                {stats.search.totalQueries === 0 && (
                  <EmptyState icon={MessageSquareOff} title="Nothing asked yet" />
                )}
              </PanelCard>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
