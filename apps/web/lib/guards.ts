import type { Role } from '@rag/shared';
import { auth } from '@/auth';
import { forbidden, unauthenticated } from './errors';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

/**
 * The actual access control, called as the first statement of every API route handler.
 *
 * Middleware is not enough and is not meant to be: it matches `/dashboard/*` only, so a
 * direct `curl -X DELETE /api/documents/:id` never passes through it. These guards run
 * inside the handler, where the request cannot route around them.
 */
export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  const user = session?.user;

  if (!user?.id || !user.email) {
    throw unauthenticated();
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name ?? user.email,
    role: user.role,
  };
}

/** Authenticated *and* an admin. Throws 401 when there is no session, 403 when the role is wrong. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== 'admin') {
    throw forbidden();
  }
  return user;
}

/** Session for Server Components, which render rather than return an error envelope. */
export async function currentUser(): Promise<SessionUser | null> {
  try {
    return await requireUser();
  } catch {
    return null;
  }
}
