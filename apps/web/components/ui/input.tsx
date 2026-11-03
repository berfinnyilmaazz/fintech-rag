import type { InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Input({
  className,
  type = 'text',
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type={type}
      className={cn(
        'h-10 w-full rounded-md border border-border-strong bg-surface px-3 text-ink text-sm',
        'placeholder:text-ink-4 disabled:opacity-50',
        'focus:border-accent-line focus:outline-none',
        className,
      )}
      {...props}
    />
  );
}
