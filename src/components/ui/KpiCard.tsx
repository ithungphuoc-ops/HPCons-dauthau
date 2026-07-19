import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

/**
 * KPI Card — HPCons Design System V1.1 §E1.
 * BẮT BUỘC đủ 4 thành phần: Icon (nền tint) + Tiêu đề + Giá trị chính (đậm 700) + Thông tin phụ/trạng thái.
 * Cấm card rỗng hoặc chỉ có biểu tượng.
 */
type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral';

const iconTone: Record<Tone, string> = {
  primary: 'bg-brand-primary/10 text-brand-primary dark:text-brand-primary-300',
  success: 'bg-brand-success/10 text-brand-success dark:text-brand-success-300',
  warning: 'bg-brand-warning/10 text-brand-warning',
  danger: 'bg-brand-danger/10 text-brand-danger',
  neutral: 'bg-brand-muted/10 text-brand-muted dark:text-slate-300',
};

export interface KpiCardProps {
  /** Icon (thường là icon Lucide) — hiển thị trên nền tint theo tone */
  icon: ReactNode;
  title: string;
  value: ReactNode;
  /** Thông tin phụ: chuỗi mô tả hoặc badge trạng thái */
  sub?: ReactNode;
  tone?: Tone;
  className?: string;
}

export function KpiCard({ icon, title, value, sub, tone = 'primary', className }: KpiCardProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl border border-hp-border bg-card p-4 shadow-sm',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wide text-text-secondary">{title}</span>
        <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl', iconTone[tone])}>
          {icon}
        </span>
      </div>
      <div className="text-2xl font-black tracking-tight text-foreground">{value}</div>
      {sub != null && <div className="text-xs font-medium text-text-desc">{sub}</div>}
    </div>
  );
}
