import { cn } from '@/lib/utils';

export type Status = 'ok' | 'deprecated' | 'running' | 'error' | 'idle';

const TONES: Record<Status, { dot: string; text: string; surface: string }> = {
  ok: { dot: 'bg-ok', text: 'text-ok', surface: 'bg-ok-soft border-ok/15' },
  deprecated: { dot: 'bg-warn', text: 'text-warn', surface: 'bg-warn-soft border-warn/15' },
  running: { dot: 'bg-info', text: 'text-info', surface: 'bg-info-soft border-info/15' },
  error: { dot: 'bg-err', text: 'text-err', surface: 'bg-err-soft border-err/15' },
  idle: { dot: 'bg-ink-4', text: 'text-ink-3', surface: 'bg-surface-2 border-border' },
};

export interface StatusBadgeProps {
  status: Status;
  children: React.ReactNode;
  className?: string;
}

/** A dot and a word on a soft ground. The dot does the colour work so the text stays legible. */
export function StatusBadge({ status, children, className }: StatusBadgeProps) {
  const tone = TONES[status];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm border px-2 py-1 font-medium text-[11.5px] leading-none',
        tone.surface,
        tone.text,
        className,
      )}
    >
      <span
        className={cn(
          'size-1.5 shrink-0 rounded-full',
          tone.dot,
          status === 'running' && 'animate-pulse',
        )}
      />
      {children}
    </span>
  );
}
