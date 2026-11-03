import { db, users } from '@rag/db';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';
import { authConfig } from './auth.config';

const CredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * A bcrypt hash of a value nobody can log in with. When the email is unknown we still run
 * a comparison against it, so a missing account and a wrong password take the same time.
 * Skipping this leaks which email addresses exist, measurable from the response time.
 */
const DUMMY_HASH = '$2b$10$CwTycUXWue0Thq9StjUM0uJ8.PT2xEcXPmpVjKnYQGGVSMr8dqPTC';

/**
 * The Node half. This adds the Credentials provider — bcrypt and a database connection,
 * neither of which exists on the edge — on top of the edge-safe config.
 *
 * Credentials requires the JWT session strategy in Auth.js v5, which is why no database
 * adapter is installed: an adapter only backs database sessions, and it would sit unused.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(raw) {
        const parsed = CredentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const [account] = await db
          .select()
          .from(users)
          .where(eq(users.email, parsed.data.email.toLowerCase()))
          .limit(1);

        const matches = await bcrypt.compare(
          parsed.data.password,
          account?.passwordHash ?? DUMMY_HASH,
        );
        if (!account || !matches) return null;

        // Only what the session needs. The password hash must never leave this function.
        return {
          id: account.id,
          email: account.email,
          name: account.name,
          role: account.role,
        };
      },
    }),
  ],
});
