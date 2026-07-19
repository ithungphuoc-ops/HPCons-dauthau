import { cn } from '../../lib/utils';
import { fmtDateVN } from '../../utils/dateVN';

/**
 * Timeline Progress — HPCons Design System V1.1 §E2.
 * Dùng THỐNG NHẤT cho mọi màn hình có thời hạn (Dự án, Công việc, Hợp đồng...).
 * Hiển thị: ngày bắt đầu · ngày kết thúc · % thời gian đã dùng · số ngày còn lại (hoặc "Quá hạn X ngày").
 * Màu thanh theo trạng thái thời gian:
 *   xanh dương (primary) → vàng (warning, ≥70%) → đỏ (danger, ≥90% hoặc quá hạn);
 *   hoàn thành = xanh lá (success).
 */
export interface TimelineProgressProps {
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  /** Đã hoàn thành → thanh xanh lá (success), bỏ qua tính toán thời gian */
  isCompleted?: boolean;
  className?: string;
}

const DAY = 86400000;

export function TimelineProgress({ startDate, endDate, isCompleted, className }: TimelineProgressProps) {
  const start = startDate ? new Date(startDate).getTime() : NaN;
  const end = endDate ? new Date(endDate).getTime() : NaN;
  const now = Date.now();

  const hasRange = !Number.isNaN(start) && !Number.isNaN(end) && end > start;
  const pctUsed = hasRange ? Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100)) : 0;
  const daysLeft = !Number.isNaN(end) ? Math.ceil((end - now) / DAY) : NaN;
  const overdue = !isCompleted && !Number.isNaN(end) && now > end;

  // Màu thanh + màu chữ trạng thái
  const barClass = isCompleted
    ? 'bg-brand-success'
    : overdue || pctUsed >= 90
      ? 'bg-brand-danger'
      : pctUsed >= 70
        ? 'bg-brand-warning'
        : 'bg-brand-primary';

  const fillPct = isCompleted ? 100 : pctUsed;

  const statusText = isCompleted
    ? 'Đã hoàn thành'
    : overdue
      ? `Quá hạn ${Math.abs(daysLeft)} ngày`
      : Number.isNaN(daysLeft)
        ? '—'
        : `Còn ${daysLeft} ngày`;

  const statusClass = isCompleted
    ? 'text-brand-success dark:text-brand-success-300'
    : overdue || pctUsed >= 90
      ? 'text-brand-danger'
      : pctUsed >= 70
        ? 'text-brand-warning'
        : 'text-brand-primary dark:text-brand-primary-300';

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-center justify-between text-xs font-semibold text-text-secondary">
        <span>{fmtDateVN(startDate)}</span>
        <span className={cn('font-bold', statusClass)}>{statusText}</span>
        <span>{fmtDateVN(endDate)}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
        <div className={cn('h-full rounded-full transition-all duration-500', barClass)} style={{ width: `${fillPct}%` }} />
      </div>
      {!isCompleted && !Number.isNaN(daysLeft) && (
        <div className="text-right text-xs font-medium text-text-desc">
          Đã dùng {Math.round(pctUsed)}% thời gian
        </div>
      )}
    </div>
  );
}
