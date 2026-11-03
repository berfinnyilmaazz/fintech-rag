import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center gap-2 px-4 py-10 text-center', className)}>
      <Icon size={18} strokeWidth={1.5} className="text-ink-4" />
      <p className="font-medium text-[13px] text-ink-2">{title}</p>
      {description && (
        <p className="max-w-sm text-[12.5px] text-ink-4 leading-relaxed">{description}</p>
      )}
    </div>
  );
}
