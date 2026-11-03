import { LogOut } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { signOutAction } from '@/lib/actions';
import { currentUser } from '@/lib/guards';

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const user = await currentUser();
  const { denied } = await searchParams;

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-12 sm:py-16">
      <header className="mb-8">
        <h1 className="font-medium text-ink text-xl tracking-tight">Fintech RAG</h1>
        <p className="mt-1.5 max-w-prose text-[13px] text-ink-3 leading-relaxed">
          Hybrid retrieval and grounded answers over internal payments documentation, with citations
          back to the source.
        </p>
      </header>

      {denied === 'dashboard' && (
        <p
          role="alert"
          className="mb-6 rounded-md border border-warn/20 bg-warn-soft px-4 py-2.5 text-[13px] text-warn"
        >
          The dashboard is restricted to admin accounts.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Session
            {user ? (
              <Badge tone={user.role === 'admin' ? 'accent' : 'neutral'}>{user.role}</Badge>
            ) : (
              <Badge tone="neutral">signed out</Badge>
            )}
          </CardTitle>
          <CardDescription>
            {user
              ? `Signed in as ${user.email}.`
              : 'Sign in with one of the demo accounts to continue.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          {user ? (
            <>
              <Link href="/chat">
                <Button>Chat</Button>
              </Link>
              <Link href="/search">
                <Button variant="secondary">Search</Button>
              </Link>
              {user.role === 'admin' && (
                <Link href="/dashboard">
                  <Button variant="secondary">Dashboard</Button>
                </Link>
              )}
              {/* This page has no AppShell, so it needs its own way out — and it is where
                  sign-in lands, which makes it the first place someone tries to switch
                  accounts. A form rather than a link: see signOutAction. */}
              <form action={signOutAction} className="ml-auto">
                <Button type="submit" variant="ghost">
                  <LogOut size={15} strokeWidth={1.5} />
                  Sign out
                </Button>
              </form>
            </>
          ) : (
            <Link href="/signin">
              <Button>Sign in</Button>
            </Link>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
