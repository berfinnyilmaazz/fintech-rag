import type { Role } from '@rag/shared';
import type { DefaultSession } from 'next-auth';

/**
 * Carries `role` and `id` through the session and the sign-in `User`.
 *
 * The JWT is deliberately not augmented. `JWT extends Record<string, unknown>` in
 * @auth/core, so an augmented property still widens to `unknown` at the read site — the
 * session callback narrows the token explicitly instead, which also makes an unrecognised
 * role fail closed rather than be trusted.
 */
declare module 'next-auth' {
  interface User {
    role: Role;
  }

  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession['user'];
  }
}
