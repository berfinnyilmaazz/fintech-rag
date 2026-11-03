import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

/**
 * The MCP server is launched by a client (Claude Desktop, Cursor) with an unpredictable
 * working directory, so .env is resolved from this file rather than from cwd.
 */
const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, '../../../.env'), quiet: true });
