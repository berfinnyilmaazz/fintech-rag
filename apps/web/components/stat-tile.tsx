import { cn } from '@/lib/utils';

export interface StatTileProps {
  label: string;
  value: string | number;
  hint?: string;
  className?: string;
}

/** A large, light number. Weight 300 keeps a figure from shouting at the label above it. */
export function StatTile({ label, value, hint, className }: StatTileProps) {
  return (
    <div className={cn('rounded-md border border-border bg-surface p-4', className)}>
      <div className="text-[11px] text-ink-4 uppercase tracking-[0.07em]">{label}</div>
      <div className="mt-1.5 font-light text-[30px] text-ink leading-none tabular-nums">
        {value}
      </div>
      {hint && <div className="mt-1.5 text-[11.5px] text-ink-4">{hint}</div>}
    </div>
  );
}
