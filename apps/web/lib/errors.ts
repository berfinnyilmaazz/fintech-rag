import type { ApiErrorCode } from '@rag/shared';
import { NextResponse } from 'next/server';

const STATUS: Readonly<Record<ApiErrorCode, number>> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};

/** Anything a route handler can fail with and still report in the shared envelope. */
export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get status(): number {
    return STATUS[this.code];
  }
}

/** No session at all. */
export const unauthenticated = (): ApiError =>
  new ApiError('UNAUTHENTICATED', 'Sign in to use this endpoint.');

/**
 * Signed in, wrong role. Distinct from 401 on purpose: 401 means "who are you?", 403 means
 * "I know who you are and the answer is no". Collapsing them tells an attacker less but
 * tells a legitimate client the wrong thing — it would send an admin-less user back to the
 * sign-in page forever.
 */
export const forbidden = (): ApiError =>
  new ApiError('FORBIDDEN', 'This endpoint requires the admin role.');

/**
 * Every route handler ends in this. Known failures keep their code and status; anything
 * else becomes a 500 with the detail logged rather than returned, so an internal message
 * never reaches the client.
 */
export function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }

  console.error('Unhandled API error:', error);
  return NextResponse.json(
    { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.' } },
    { status: 500 },
  );
}
