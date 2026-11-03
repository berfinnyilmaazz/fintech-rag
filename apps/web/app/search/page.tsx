import { getStats } from '@rag/core';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { currentUser } from '@/lib/guards';
import { SearchView } from './SearchView';

export const metadata = { title: 'Search · Fintech RAG' };

export default async function SearchPage() {
  const user = await currentUser();
  if (!user) redirect('/signin?callbackUrl=/search');

  const stats = await getStats();

  return (
    <AppShell user={user} active="/search">
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="border-border border-b bg-surface px-5 py-3 nav:px-8">
          <h1 className="font-medium text-[15px] text-ink tracking-tight">Search</h1>
          <p className="mt-0.5 text-[11.5px] text-ink-4">
            Retrieval only — no model in the loop. {stats.corpus.chunks} chunks indexed.
          </p>
        </header>
        <SearchView />
      </div>
    </AppShell>
  );
}
