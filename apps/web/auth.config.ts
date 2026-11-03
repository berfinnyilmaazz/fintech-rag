import { NextResponse } from 'next/server';
import type { NextAuthConfig } from 'next-auth';

/**
 * The edge-safe half of the auth setup.
 *
 * `middleware.ts` runs on the edge runtime, where neither bcrypt nor a Postgres socket
 * exists. Everything in this file has to survive that: callbacks only, an empty provider
 * list, and no database access. `auth.ts` spreads this and adds the Credentials provider
 * on top for route handlers and Server Components, which run on Node.
 *
 * Splitting it this way works whether or not the middleware runtime is configurable, which
 * is why it is preferred over relying on a runtime flag.
 */
export const authConfig = {
  pages: { signIn: '/signin' },
  session: { strategy: 'jwt' },
  providers: [],
  callbacks: {
    /**
     * Middleware-level gating. This is UX — it keeps people from landing on a page they
     * cannot use. It is NOT the security boundary; every API route calls a guard of its
     * own, because a request can reach a route handler without passing through here.
     */
    authorized({ auth, request }) {
      const isDashboard = request.nextUrl.pathname.startsWith('/dashboard');
      if (!isDashboard) return true;

      const user = auth?.user;
      if (!user) return false; // Auth.js redirects to the sign-in page.

      // Signed in but not an admin: bouncing them to the sign-in page would be a lie —
      // they are signed in. Send them somewhere they can actually use.
      if (user.role !== 'admin') {
        return NextResponse.redirect(new URL('/?denied=dashboard', request.nextUrl));
      }
      return true;
    },

    jwt({ token, user }) {
      // `user` is only present on the sign-in call; afterwards the claims come off the token.
      if (user) {
        token.id = user.id ?? '';
        token.role = user.role;
      }
      return token;
    },

    session({ session, token }) {
      // `JWT extends Record<string, unknown>`, so these arrive as `unknown` whatever the
      // module augmentation says. Narrowing them here is not ceremony: the role decides
      // authorisation, and an unrecognised value must fail closed to 'user' rather than be
      // trusted because the type said so.
      session.user.id = typeof token.id === 'string' ? token.id : '';
      session.user.role = token.role === 'admin' ? 'admin' : 'user';
      return session;
    },
  },
} satisfies NextAuthConfig;
