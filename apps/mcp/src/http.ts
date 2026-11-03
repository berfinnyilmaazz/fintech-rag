import './env';
import { createMcpExpressApp, requireBearerAuth } from '@modelcontextprotocol/express';
import { NodeStreamableHTTPServerTransport } from '@modelcontextprotocol/node';
import { StaticTokenVerifier } from './auth';
import { createServer } from './server';

/**
 * Streamable HTTP transport.
 *
 *   pnpm --filter @rag/mcp http
 *   curl -H "Authorization: Bearer $MCP_BEARER_TOKEN" -X POST localhost:3333/mcp …
 *
 * ── On OIDC, honestly ──────────────────────────────────────────────────────────────────
 * This is bearer-token auth against a shared secret, not OpenID Connect. Saying otherwise
 * would be a half-built version of it.
 *
 * The gap is small and specific, because the SDK already provides both halves this project
 * does not use:
 *
 *   1. Replace `StaticTokenVerifier` with a verifier that fetches the provider's JWKS and
 *      validates the token's signature, `iss`, `aud` and `exp`. `requireBearerAuth` takes
 *      any `OAuthTokenVerifier`, so nothing else in this file changes.
 *   2. Mount `mcpAuthMetadataRouter({ oauthMetadata, resourceServerUrl })` from
 *      `@modelcontextprotocol/express`. It serves `.well-known/oauth-protected-resource`
 *      (RFC 9728) and `.well-known/oauth-authorization-server` (RFC 8414), which is how a
 *      client discovers the authorization server from the 401 challenge this server
 *      already sends.
 *
 * Token verification lives in exactly one place precisely so that swap is a one-file
 * change. What is missing is an identity provider to verify against, not the wiring.
 */

const PORT = Number(process.env.MCP_HTTP_PORT ?? 3333);
const TOKEN = process.env.MCP_BEARER_TOKEN ?? '';

const app = createMcpExpressApp();
const verifier = new StaticTokenVerifier(TOKEN);

app.post(
  '/mcp',
  // First, before anything reads the body: an unauthenticated request must not reach the
  // retrieval pipeline at all.
  requireBearerAuth({ verifier }),
  async (request, response) => {
    // Stateless: one transport and one server instance per request. Sessions would need a
    // transport kept alive per session id, which buys nothing for a search tool.
    const transport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    const server = createServer();

    response.on('close', () => {
      void transport.close();
      void server.close();
    });

    await server.connect(transport);
    await transport.handleRequest(request, response, request.body);
  },
);

app.get('/health', (_request, response) => {
  response.json({ ok: true, server: 'fintech-rag-mcp' });
});

app.listen(PORT, () => {
  console.log(`MCP Streamable HTTP listening on http://127.0.0.1:${PORT}/mcp`);
  console.log('Authorization: Bearer <MCP_BEARER_TOKEN> required.');
});
