import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from './env';
import * as schema from './schema';

/**
 * Reuse one pool across module reloads. Next's dev server re-evaluates modules on every
 * change, which would otherwise open a new pool each time until Postgres refuses
 * connections.
 */
const globalForDb = globalThis as unknown as { ragPool?: ReturnType<typeof postgres> };

const pool = globalForDb.ragPool ?? postgres(env.DATABASE_URL, { max: 10 });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.ragPool = pool;
}

export const db = drizzle(pool, { schema });
export type Db = typeof db;

/** CLI scripts must close the pool explicitly or the process hangs on an open socket. */
export async function closeDb(): Promise<void> {
  await pool.end();
  globalForDb.ragPool = undefined;
}
