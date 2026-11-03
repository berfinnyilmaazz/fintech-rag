import { cn } from '@/lib/utils';

export interface ScoreBarProps {
  /** Raw score. RRF values sit near 0.03, cosine near 0.8, so `max` normalises the rail. */
  value: number;
  max?: number;
  /** Warn-toned rail for deprecated sources, so the colour still carries meaning. */
  tone?: 'accent' | 'warn';
  digits?: number;
  className?: string;
}

export function ScoreBar({
  value,
  max = 1,
  tone = 'accent',
  digits = 4,
  className,
}: ScoreBarProps) {
  const filled = Math.max(0, Math.min(1, max === 0 ? 0 : value / max));

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span className="font-mono text-[11.5px] text-ink-3 tabular-nums">
        {value.toFixed(digits)}
      </span>
      <span className="h-[3px] w-11 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        <span
          className={cn('block h-full rounded-full', tone === 'warn' ? 'bg-warn' : 'bg-accent')}
          style={{ width: `${filled * 100}%` }}
        />
      </span>
    </span>
  );
}
