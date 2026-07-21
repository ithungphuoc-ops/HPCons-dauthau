import type { ComponentProps } from 'react';
import { cn } from '../../lib/utils';

/** Card — khối bọc chuẩn cho nội dung dạng thẻ (KPI, thống kê...), bo góc 12px theo quy ước của app. */
export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="card"
      className={cn('rounded-xl border border-hp-border bg-card shadow-sm', className)}
      {...props}
    />
  );
}
