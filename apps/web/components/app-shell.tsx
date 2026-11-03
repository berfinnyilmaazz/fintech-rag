import { LayoutDashboard, Lock, LogOut, MessagesSquare, Search } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { signOutAction } from '@/lib/actions';
import type { SessionUser } from '@/lib/guards';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: typeof MessagesSquare;
  adminOnly?: boolean;
}

const MAIN: NavItem[] = [
  { href: '/chat', label: 'Chat', icon: MessagesSquare },
  { href: '/search', label: 'Search', icon: Search },
];

const ADMIN: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, adminOnly: true },
];

function NavLink({ item, active, locked }: { item: NavItem; active: boolean; locked: boolean }) {
  const content = (
    <>
      <item.icon size={16} strokeWidth={1.5} className={active ? 'text-accent' : 'text-ink-4'} />
      <span className="flex-1">{item.label}</span>
      {locked && <Lock size={14} strokeWidth={1.5} className="text-ink-4" />}
    </>
  );

  const className = cn(
    'flex items-center gap-2.5 rounded-sm px-2.5 py-2 text-[13px] transition-colors',
    active && 'bg-accent-soft font-medium text-accent',
    !active && !locked && 'text-ink-2 hover:bg-surface-2',
    locked && 'cursor-not-allowed text-ink-4',
  );

  if (locked) {
    return (
      <span className={className} aria-disabled title="Admin accounts only">
        {content}
      </span>
    );
  }
  return (
    <Link href={item.href} className={className} aria-current={active ? 'page' : undefined}>
      {content}
    </Link>
  );
}

export interface AppShellProps {
  user: SessionUser;
  active: string;
  children: ReactNode;
}

/**
 * Sidebar at 216px on wide screens, collapsing into a top bar below 960px. Shared by chat
 * and dashboard so the two never drift into looking like different products.
 */
export function AppShell({ user, active, children }: AppShellProps) {
  const initial = (user.name || user.email).charAt(0).toUpperCase();

  return (
    <div className="flex min-h-dvh flex-col nav:flex-row">
      <aside className="flex shrink-0 flex-col gap-4 border-border border-b bg-surface px-4 py-3 nav:w-[216px] nav:border-r nav:border-b-0 nav:px-3 nav:py-4">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 nav:block">
          <Link
            href="/"
            className="shrink-0 whitespace-nowrap font-medium text-[13px] text-ink tracking-tight"
          >
            Fintech RAG
          </Link>

          {/* Below 960px the nav sits inline next to the brand rather than stacking. */}
          <nav className="flex items-center gap-1 nav:mt-5 nav:flex-col nav:items-stretch nav:gap-0.5">
            {MAIN.map((item) => (
              <NavLink key={item.href} item={item} active={active === item.href} locked={false} />
            ))}
            {ADMIN.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                active={active === item.href}
                locked={user.role !== 'admin'}
              />
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2.5 border-border border-t pt-3 nav:mt-auto">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-2 font-medium text-[12px] text-ink-2">
            {initial}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium text-[12.5px] text-ink">{user.name}</div>
            <div className="truncate text-[11px] text-ink-4">{user.email}</div>
          </div>
          <span
            className={cn(
              'rounded-sm border px-1.5 py-0.5 font-medium text-[10.5px] leading-none',
              user.role === 'admin'
                ? 'border-accent-line bg-accent-soft text-accent'
                : 'border-border bg-surface-2 text-ink-3',
            )}
          >
            {user.role}
          </span>

          {/* A form, not a link: see signOutAction. It lives in the user card rather than in
              a menu so it is reachable in one tap at every width — the sidebar collapses into
              this same row below 960px. */}
          <form action={signOutAction} className="shrink-0">
            <button
              type="submit"
              title="Sign out"
              aria-label="Sign out"
              className="flex size-7 items-center justify-center rounded-sm text-ink-4 transition-colors hover:bg-surface-2 hover:text-ink-2 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-1"
            >
              <LogOut size={15} strokeWidth={1.5} />
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
