import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface PanelCardProps {
  title: string;
  /** Right-aligned counter or note; kept small so it never competes with the title. */
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function PanelCard({ title, aside, children, className, bodyClassName }: PanelCardProps) {
  return (
    <section className={cn('rounded-md border border-border bg-surface', className)}>
      <header className="flex items-center justify-between gap-3 border-border border-b px-4 py-3">
        <h2 className="font-medium text-[13px] text-ink">{title}</h2>
        {aside && <div className="text-[11.5px] text-ink-4">{aside}</div>}
      </header>
      <div className={cn('p-4', bodyClassName)}>{children}</div>
    </section>
  );
}
