import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { Card } from './Card';

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
    <Card className={cn('flex items-start gap-4 p-4', className)}>
      <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-lg', iconTone[tone])}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-text-secondary">{title}</p>
        <p className="mt-0.5 truncate text-2xl font-bold leading-tight text-foreground">{value}</p>
        {sub != null && <div className="mt-1 text-xs text-text-desc">{sub}</div>}
      </div>
    </Card>
  );
}
