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

// HẠN NỘP TÍNH TỚI HẾT NGÀY (chị Trâm chốt 29/07/2026).
// Hạn 30-07-2026 nghĩa là còn NGUYÊN ngày 30-07 để làm, tới 23:59:59 mới hết — chứ không phải
// vừa sang 0h ngày 30-07 là coi như cạn giờ. Trước đây so bằng mốc giờ thô nên đúng ngày hết hạn
// thanh đã đỏ, ghi "Quá hạn 0 ngày" và "đã dùng 100% thời gian" — vừa sai vừa vô nghĩa.
// Cố ý tự tách Y-M-D chứ không dùng new Date('2026-07-30'): chuỗi kiểu đó bị đọc là 0h UTC nên
// lệch múi giờ, riêng giờ Việt Nam (GMT+7) thì thành 7h sáng.
const moc = (v: string | Date, cuoiNgay: boolean): number => {
  const d = typeof v === 'string'
    ? (() => {
        const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
        return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(v);
      })()
    : new Date(v);
  if (Number.isNaN(d.getTime())) return NaN;
  if (cuoiNgay) d.setHours(23, 59, 59, 999);
  else d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export function TimelineProgress({ startDate, endDate, isCompleted, className }: TimelineProgressProps) {
  const start = startDate ? moc(startDate, false) : NaN;
  const end = endDate ? moc(endDate, true) : NaN;       // hết ngày hạn, không phải đầu ngày
  const now = Date.now();

  const hasRange = !Number.isNaN(start) && !Number.isNaN(end) && end > start;
  const pctUsed = hasRange ? Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100)) : 0;
  // Đếm theo NGÀY: 0 = hết hạn hôm nay (vẫn còn giờ làm), âm = đã quá hạn.
  const daysLeft = !Number.isNaN(end)
    ? Math.round((moc(endDate!, false) - moc(new Date(), false)) / DAY)
    : NaN;
  const overdue = !isCompleted && !Number.isNaN(daysLeft) && daysLeft < 0;

  // Màu thanh + màu chữ trạng thái
  const barClass = isCompleted
    ? 'bg-brand-success'
    : overdue || pctUsed >= 90
      ? 'bg-brand-danger'
      : pctUsed >= 70
        ? 'bg-brand-warning'
        : 'bg-brand-primary';

  const fillPct = isCompleted ? 100 : pctUsed;

  // "Đến hạn hôm nay" dùng đúng câu chữ với bảng việc của tôi (MyTasksPanel) cho khỏi lệch nhau.
  // Không bao giờ còn ra "Quá hạn 0 ngày" nữa: 0 ngày nghĩa là hôm nay vẫn làm được.
  const statusText = isCompleted
    ? 'Đã hoàn thành'
    : Number.isNaN(daysLeft)
      ? '—'
      : overdue
        ? `Quá hạn ${Math.abs(daysLeft)} ngày`
        : daysLeft === 0
          ? 'Đến hạn hôm nay'
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
