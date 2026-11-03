import { getStats } from '@rag/core';
import { NextResponse } from 'next/server';
import { toErrorResponse } from '@/lib/errors';
import { requireAdmin } from '@/lib/guards';

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json(await getStats());
  } catch (error) {
    return toErrorResponse(error);
  }
}
