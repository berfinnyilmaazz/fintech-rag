import { getStats } from '@rag/core';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { currentUser } from '@/lib/guards';
import { ChatView } from './ChatView';

export const metadata = { title: 'Chat · Fintech RAG' };

function relativeTime(iso: string | null): string {
  if (!iso) return 'never indexed';
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'updated just now';
  if (minutes < 60) return `updated ${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `updated ${hours}h ago`;
  return `updated ${Math.round(hours / 24)}d ago`;
}

export default async function ChatPage() {
  // Chat is not covered by the proxy matcher, so this check is the one that gates the page.
  const user = await currentUser();
  if (!user) redirect('/signin?callbackUrl=/chat');

  const stats = await getStats();

  return (
    <AppShell user={user} active="/chat">
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-border border-b bg-surface px-5 py-3 nav:px-8">
          <div>
            <h1 className="font-medium text-[15px] text-ink tracking-tight">Ask the corpus</h1>
            <p className="mt-0.5 text-[11.5px] text-ink-4">
              {stats.corpus.documents} documents indexed ·{' '}
              {relativeTime(stats.corpus.lastIndexedAt)}
            </p>
          </div>
        </header>
        <ChatView />
      </div>
    </AppShell>
  );
}
