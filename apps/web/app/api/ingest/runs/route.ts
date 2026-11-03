import { listIngestionRuns } from '@rag/core';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { toErrorResponse } from '@/lib/errors';
import { requireAdmin } from '@/lib/guards';
import { parseSearchParams } from '@/lib/request';

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(request: Request) {
  try {
    await requireAdmin();

    const { limit } = parseSearchParams(new URL(request.url), QuerySchema);
    return NextResponse.json({ runs: await listIngestionRuns(limit) });
  } catch (error) {
    return toErrorResponse(error);
  }
}
