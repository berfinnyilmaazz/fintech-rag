'use server';

import { signOut } from '@/auth';

/**
 * Sign out, as a Server Action invoked from a `<form action={…}>`.
 *
 * Deliberately not a link. A GET that destroys a session can be triggered by any page that
 * embeds the URL — a prefetch or an `<img src>` is enough — so the sign-out has to be a POST
 * the browser only issues on a real submit. Auth.js's own documentation uses this shape for
 * the same reason.
 */
export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: '/signin' });
}
