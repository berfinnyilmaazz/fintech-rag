import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Conditional class names with conflict resolution: a caller passing `px-4` to a component
 * whose base is `px-3` gets `px-4`, rather than both and whichever CSS order decides.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
