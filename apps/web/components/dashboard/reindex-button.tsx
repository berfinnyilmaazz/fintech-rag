'use client';

import { RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Triggers ingestion and hands off to polling.
 *
 * The endpoint returns 202 with a run id in about 170 ms; the work continues in the
 * background. `router.refresh()` re-renders the server component so the new run appears in
 * the history panel, which then polls it to completion.
 */
export function ReindexButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const detail: unknown = await response.json().catch(() => null);
        console.error('Ingestion could not be started', response.status, detail);
        setError('Could not start indexing.');
        return;
      }
      router.refresh();
    } catch (caught: unknown) {
      console.error('Ingestion could not be started', caught);
      setError('Could not start indexing.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-[11.5px] text-err">{error}</span>}
      <Button onClick={() => void start()} disabled={busy}>
        <RefreshCw size={16} strokeWidth={1.5} className={cn(busy && 'animate-spin')} />
        {busy ? 'Starting…' : 'Re-index'}
      </Button>
    </div>
  );
}
