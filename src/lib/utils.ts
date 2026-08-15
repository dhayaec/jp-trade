import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Re-export format functions for convenience
export {
  formatPrice,
  formatRatio,
  formatPercent,
  formatTimestamp,
} from '@/features/dashboard/format';
