import { ApiError } from './errors';

/**
 * A token bucket per caller, held in process memory.
 *
 * ⚠️ Single-instance only. Two Next processes behind a load balancer would each allow the
 * full quota, and the map dies with the process. That is an acceptable trade for a local
 * project and a documented limitation in the README — production wants Redis, where the
 * counter lives outside the instance. What matters here is that the LLM endpoints are not
 * left unbounded.
 */
interface Bucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitOptions {
  /** Bucket size: the most requests allowed in a burst. */
  capacity: number;
  /** Tokens added per second. */
  refillPerSecond: number;
}

/** Chat calls an LLM and search runs the embedding model, so both are worth bounding. */
export const CHAT_LIMIT: RateLimitOptions = { capacity: 10, refillPerSecond: 0.2 };
export const SEARCH_LIMIT: RateLimitOptions = { capacity: 20, refillPerSecond: 0.5 };

/**
 * Consumes one token for `key`, or throws 429.
 *
 * Keyed by user id rather than IP: the endpoints are behind authentication, so the account
 * is both the more meaningful subject and the one an attacker cannot rotate for free.
 */
export function consumeToken(key: string, options: RateLimitOptions): void {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { tokens: options.capacity, lastRefill: now };

  const elapsedSeconds = (now - bucket.lastRefill) / 1000;
  bucket.tokens = Math.min(
    options.capacity,
    bucket.tokens + elapsedSeconds * options.refillPerSecond,
  );
  bucket.lastRefill = now;

  if (bucket.tokens < 1) {
    buckets.set(key, bucket);
    const waitSeconds = Math.ceil((1 - bucket.tokens) / options.refillPerSecond);
    throw new ApiError('RATE_LIMITED', `Too many requests. Try again in ${waitSeconds}s.`);
  }

  bucket.tokens -= 1;
  buckets.set(key, bucket);
}

/** Test hook — the limiter is module state, so a test would otherwise leak between cases. */
export function resetRateLimits(): void {
  buckets.clear();
}
