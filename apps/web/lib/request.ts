import type { z } from 'zod';
import { ApiError } from './errors';

/**
 * Parses a JSON body against a schema, or throws a 400 in the shared envelope.
 *
 * Malformed JSON and a schema mismatch both land here, so a route never sees an unvalidated
 * body and never has to decide what to do about one.
 */
export async function parseJsonBody<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ApiError('VALIDATION_ERROR', 'Request body must be valid JSON.');
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new ApiError('VALIDATION_ERROR', formatIssues(result.error));
  }
  return result.data;
}

/** Same, for query strings. */
export function parseSearchParams<T>(url: URL, schema: z.ZodType<T>): T {
  const result = schema.safeParse(Object.fromEntries(url.searchParams));
  if (!result.success) {
    throw new ApiError('VALIDATION_ERROR', formatIssues(result.error));
  }
  return result.data;
}

/**
 * Zod issues flattened into one line. The path matters — "topK: expected <= 20" is
 * actionable, "invalid input" is not — but the raw issue array is noise in an envelope
 * whose shape every route shares.
 */
function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.join('.');
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join('; ');
}
