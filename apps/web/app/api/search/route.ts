import { search } from '@rag/core';
import { SearchRequestSchema } from '@rag/shared';
import { NextResponse } from 'next/server';
import { toErrorResponse } from '@/lib/errors';
import { requireUser } from '@/lib/guards';
import { consumeToken, SEARCH_LIMIT } from '@/lib/rate-limit';
import { parseJsonBody } from '@/lib/request';

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    consumeToken(`search:${user.id}`, SEARCH_LIMIT);

    const body = await parseJsonBody(request, SearchRequestSchema);
    const result = await search({
      query: body.query,
      topK: body.topK,
      mode: body.mode,
      docType: body.docType,
      project: body.project,
    });

    return NextResponse.json({
      query: body.query,
      mode: result.mode,
      chunks: result.chunks,
      topCosine: result.topCosine,
      latencyMs: result.latencyMs,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
