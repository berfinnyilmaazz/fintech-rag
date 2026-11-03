import { resolveCorpusPath, runIngestion } from '@rag/core';
import { db, ingestionRuns } from '@rag/db';
import { IngestTriggerSchema } from '@rag/shared';
import { NextResponse } from 'next/server';
import { toErrorResponse } from '@/lib/errors';
import { requireAdmin } from '@/lib/guards';
import { parseJsonBody } from '@/lib/request';

/**
 * Starts an ingestion run and returns immediately with its id.
 *
 * It cannot be synchronous: a full re-index of this corpus measured 37 s, which no HTTP
 * client should be asked to hold open. The dashboard polls /api/ingest/runs instead.
 *
 * ⚠️ The background task is tied to this process. On a serverless platform the function may
 * be frozen once the response is sent, leaving a run stuck on 'running' — noted in the
 * README's limitations. Locally, and on any long-lived Node process, it completes.
 */
export async function POST(request: Request) {
  try {
    await requireAdmin();

    const body = await parseJsonBody(request, IngestTriggerSchema.optional().catch({}));
    const corpusPath = resolveCorpusPath(body?.corpusPath);

    const started = await openRun();

    // Deliberately not awaited. The catch is not optional: an unhandled rejection here
    // would take the process down and leave the run row open forever.
    void runIngestion({ corpusPath, trigger: 'dashboard', runId: started.runId }).catch(
      (error: unknown) => {
        console.error('Background ingestion failed:', error);
      },
    );

    return NextResponse.json(started, { status: 202 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

async function openRun(): Promise<{ runId: string; status: 'running' }> {
  const [run] = await db
    .insert(ingestionRuns)
    .values({ trigger: 'dashboard' })
    .returning({ id: ingestionRuns.id });

  if (!run) throw new Error('Could not open an ingestion run');
  return { runId: run.id, status: 'running' };
}
