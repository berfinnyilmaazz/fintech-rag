import {
  type AuthInfo,
  OAuthError,
  OAuthErrorCode,
  type OAuthTokenVerifier,
} from '@modelcontextprotocol/server';

/**
 * A shared-secret token verifier.
 *
 * It implements the SDK's `OAuthTokenVerifier` interface rather than being a hand-rolled
 * header check, and that is the point: `requireBearerAuth` already speaks this interface,
 * already emits the RFC 9728 `WWW-Authenticate` challenge, and already returns the right
 * status codes. **Moving to full OIDC replaces this one class and nothing else** — see the
 * note in http.ts.
 *
 * What this is not: it is not OIDC. There is no issuer, no audience check, no signature,
 * no expiry, no revocation. It is a shared secret, appropriate for a locally-run server on
 * a trusted machine and stated as such in the README rather than dressed up.
 */
export class StaticTokenVerifier implements OAuthTokenVerifier {
  constructor(private readonly expected: string) {
    if (expected.trim() === '') {
      throw new Error('MCP_BEARER_TOKEN is empty — refusing to start an unauthenticated server.');
    }
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    if (!timingSafeEqual(token, this.expected)) {
      throw new OAuthError(OAuthErrorCode.InvalidToken, 'Invalid bearer token.');
    }

    return {
      token,
      clientId: 'mcp-client',
      scopes: ['corpus:search'],
      // The helpers reject a token with no expiry, so a shared secret is given a rolling
      // one. It is a formality here, not a security property.
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    };
  }
}

/**
 * Constant-time comparison. A shared secret checked with `===` leaks its prefix through
 * response timing, and the fix costs three lines.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
