import { softDeleteDocument } from '@rag/core';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiError, toErrorResponse } from '@/lib/errors';
import { requireAdmin } from '@/lib/guards';

const ParamsSchema = z.object({ id: z.string().uuid('id must be a UUID') });

/**
 * Soft-deletes a document and drops its chunks.
 *
 * requireAdmin() is the first statement and it throws, so nothing below it runs for a
 * non-admin. That ordering is the whole point: an endpoint that returns 403 *after*
 * deleting is worse than one with no check at all, because it looks safe.
 */
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();

    // Next 16: route params are async.
    const parsed = ParamsSchema.safeParse(await context.params);
    if (!parsed.success) {
      throw new ApiError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid id.');
    }

    const result = await softDeleteDocument(parsed.data.id);
    if (!result) {
      throw new ApiError('NOT_FOUND', 'No indexed document with that id.');
    }

    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
