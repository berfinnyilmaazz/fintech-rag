import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { z } from 'zod';

/**
 * The .env lives at the repo root, but scripts run with their own package as cwd
 * (`pnpm --filter @rag/db seed`), so resolve it relative to this file rather than to
 * process.cwd(). dotenv does not overwrite variables that are already set, so a real
 * environment — CI, a container, Next's own loader — always wins over the file.
 */
const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, '../../../.env'), quiet: true });

/**
 * The message is attached to the *type* error as well as the length one. `.min(1, msg)`
 * alone never fires when the variable is simply absent — Zod reports "expected string,
 * received undefined" instead, which does not tell anyone what to do about it.
 */
const MISSING = 'DATABASE_URL is not set — copy .env.example to .env and set it';

const EnvSchema = z.object({
  DATABASE_URL: z.string({ error: MISSING }).min(1, MISSING),
});

export const env = EnvSchema.parse(process.env);
