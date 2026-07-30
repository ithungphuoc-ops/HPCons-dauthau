import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

/**
 * Empty State — HPCons Design System V1.1 §E3.
 * Màn hình chưa có dữ liệu: Icon + Tiêu đề + Mô tả + Hành động (nếu có).
 * Cấm để khoảng trắng lớn khi không có dữ liệu.
 */
export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 px-4 py-10 text-center', className)}>
      {icon && (
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-primary/10 text-brand-primary dark:text-brand-primary-300">
          {icon}
        </span>
      )}
      <h4 className="text-sm font-bold text-foreground">{title}</h4>
      {description && <p className="max-w-sm text-xs font-medium text-text-desc">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
