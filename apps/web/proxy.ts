import NextAuth from 'next-auth';
import { authConfig } from './auth.config';

// Next 16 renamed the middleware file convention to `proxy`; middleware.ts still works
// but warns on every build. Same export shape, same edge runtime.
// Only the edge-safe config is instantiated here — no Credentials provider, so no bcrypt
// and no database driver reach the edge bundle.
export default NextAuth(authConfig).auth;

export const config = {
  // Deliberately narrow. Middleware is the UX layer; API routes enforce their own access
  // with requireUser/requireAdmin, so widening this would give a false sense of coverage.
  matcher: ['/dashboard/:path*'],
};
