import { cn } from '../../lib/utils';

/**
 * Skeleton — HPCons Design System V1.1 §E3.
 * Khối giữ chỗ khi đang tải; nên tạo đúng hình dạng nội dung sẽ hiện.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-black/5 dark:bg-white/10', className)} />;
}
