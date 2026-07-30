import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * cn() — gộp className (clsx) + hợp nhất xung đột Tailwind (tailwind-merge).
 * Tiện ích nền của thư viện component dùng chung HPCons (theo mẫu shadcn/ui).
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
