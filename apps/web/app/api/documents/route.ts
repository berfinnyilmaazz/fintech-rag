import { listDocuments } from '@rag/core';
import { DocumentQuerySchema } from '@rag/shared';
import { NextResponse } from 'next/server';
import { toErrorResponse } from '@/lib/errors';
import { requireAdmin } from '@/lib/guards';
import { parseSearchParams } from '@/lib/request';

export async function GET(request: Request) {
  try {
    await requireAdmin();

    const query = parseSearchParams(new URL(request.url), DocumentQuerySchema);
    return NextResponse.json(await listDocuments(query));
  } catch (error) {
    return toErrorResponse(error);
  }
}
