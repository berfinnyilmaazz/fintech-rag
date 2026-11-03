import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createServer } from './server';

/**
 * stdio transport, for Claude Desktop and Cursor.
 *
 * v2 takes a server *factory* — `serveStdio(() => server)` — rather than v1's
 * `server.connect(new StdioServerTransport())`. The entry owns the transport and pins one
 * instance for the connection.
 *
 * Nothing may be written to stdout except protocol frames, so every diagnostic goes to
 * stderr. A stray console.log here corrupts the stream and the client simply disconnects.
 */
serveStdio(createServer, {
  onerror: (error) => {
    console.error('[mcp:stdio]', error.message);
  },
});

console.error('[mcp:stdio] fintech-rag ready');
