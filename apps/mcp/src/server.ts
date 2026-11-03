import './env';
import { McpServer } from '@modelcontextprotocol/server';
import { registerTools } from './tools';

export const SERVER_INFO = { name: 'fintech-rag', version: '1.0.0' } as const;

/**
 * A factory, not a singleton: `serveStdio` pins one instance per connection, and the HTTP
 * transport builds one per request in stateless mode. Both eras are served from the same
 * registration.
 */
export function createServer(): McpServer {
  const server = new McpServer(SERVER_INFO, { capabilities: { tools: {} } });
  registerTools(server);
  return server;
}
