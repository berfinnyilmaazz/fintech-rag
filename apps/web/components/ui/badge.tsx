import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Tone = 'neutral' | 'accent' | 'ok' | 'warn' | 'err' | 'info';

const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-ink-2 border-border',
  accent: 'bg-accent-soft text-accent border-accent-line',
  ok: 'bg-ok-soft text-ok border-ok/20',
  warn: 'bg-warn-soft text-warn border-warn/20',
  err: 'bg-err-soft text-err border-err/20',
  info: 'bg-info-soft text-info border-info/20',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ tone = 'neutral', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-medium text-[11px] leading-none',
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}
