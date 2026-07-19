import { cva, type VariantProps } from 'class-variance-authority';
import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

/**
 * Badge trạng thái — HPCons Design System V1.1 §E4.
 * 5 biến thể theo bảng màu B1: primary / success / warning / danger / neutral.
 * Nền tint (-bg), chữ đậm (-soft), LUÔN kèm chữ, tối thiểu 12px (text-xs).
 */
const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap border',
  {
    variants: {
      variant: {
        primary: 'bg-brand-primary/10 text-brand-primary dark:text-brand-primary-300 border-brand-primary/25',
        success: 'bg-brand-success/10 text-brand-success dark:text-brand-success-300 border-brand-success/25',
        warning: 'bg-brand-warning/10 text-brand-warning border-brand-warning/25',
        danger: 'bg-brand-danger/10 text-brand-danger border-brand-danger/25',
        neutral: 'bg-brand-muted/10 text-brand-muted dark:text-slate-300 border-brand-muted/25',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
);

export interface BadgeProps extends VariantProps<typeof badgeVariants> {
  children: ReactNode;
  /** Icon tuỳ chọn đặt trước chữ (ví dụ một icon Lucide) */
  icon?: ReactNode;
  className?: string;
  title?: string;
}

export function Badge({ variant, icon, children, className, title }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} title={title}>
      {icon}
      {children}
    </span>
  );
}

export { badgeVariants };
