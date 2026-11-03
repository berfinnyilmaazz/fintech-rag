import { Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { SignInForm } from './SignInForm';

export const metadata = { title: 'Sign in · Fintech RAG' };

export default function SignInPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-12">
      <div className="mb-6">
        <h1 className="font-medium text-ink text-lg tracking-tight">Fintech RAG</h1>
        <p className="mt-1 text-ink-3 text-[13px]">
          Search and grounded answers over a fintech documentation corpus.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Use one of the demo accounts below.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* useSearchParams needs a Suspense boundary to keep the page statically shell-rendered. */}
          <Suspense fallback={<Skeleton className="h-56 w-full" />}>
            <SignInForm />
          </Suspense>
        </CardContent>
      </Card>

      <div className="mt-4 rounded-md border border-border bg-surface-2 px-4 py-3">
        <p className="mb-2 font-medium text-[12px] text-ink-3">Demo accounts</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-[12px] text-ink-2">
          <dt className="text-ink-4">user</dt>
          <dd>user@demo.local · user1234</dd>
          <dt className="text-ink-4">admin</dt>
          <dd>admin@demo.local · admin1234</dd>
        </dl>
      </div>
    </main>
  );
}
