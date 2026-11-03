import bcrypt from 'bcryptjs';
import { closeDb, db } from './client';
import { type NewUser, users } from './schema';

const BCRYPT_ROUNDS = 10;

const DEMO_USERS: ReadonlyArray<Omit<NewUser, 'passwordHash'> & { password: string }> = [
  { email: 'user@demo.local', name: 'Demo User', role: 'user', password: 'user1234' },
  { email: 'admin@demo.local', name: 'Demo Admin', role: 'admin', password: 'admin1234' },
];

async function seed(): Promise<void> {
  for (const { password, ...user } of DEMO_USERS) {
    await db
      .insert(users)
      .values({ ...user, passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS) })
      .onConflictDoNothing({ target: users.email });
  }

  const seeded = await db.select({ email: users.email, role: users.role }).from(users);
  console.table(seeded);
  console.log(`Seeded ${DEMO_USERS.length} demo users (re-running is a no-op).`);
}

seed()
  .catch((error: unknown) => {
    console.error('Seed failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(closeDb);
