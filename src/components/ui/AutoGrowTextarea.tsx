import { useLayoutEffect, useRef } from 'react';
import type { TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

/**
 * Ô nhập nhiều dòng TỰ GIÃN theo nội dung (chị Trâm chốt 29/07/2026).
 *
 * Vì sao cần: các ô "cập nhật kết quả công việc", "lý do dời hạn", "kế hoạch chi tiết"... trước đây
 * bị đóng cứng chiều cao (h-16 / h-20 / h-24) nên nội dung dài hơn 2-3 dòng là phải cuộn TRONG ô —
 * người đọc không thấy được toàn bộ, phải kéo từng đoạn, rất khó soát. Ô "Mô tả dự án" đã tự giãn
 * từ 26/07 và dùng thấy dễ hơn hẳn, nên gom thành component dùng chung cho mọi ô cùng loại.
 *
 * Cách chạy: sau mỗi lần nội dung đổi thì đặt lại height = scrollHeight, và tắt thanh cuộn
 * (overflow-hidden) + tắt tay kéo góc (resize-none) để không còn ô nào bị cắt chữ.
 */
export interface AutoGrowTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Số dòng tối thiểu khi ô còn trống (mặc định 3). */
  minRows?: number;
}

export function AutoGrowTextarea({ minRows = 3, className, ...rest }: AutoGrowTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // useLayoutEffect (không phải useEffect) để chỉnh chiều cao TRƯỚC khi trình duyệt vẽ,
  // tránh nhấp nháy một khung sai chiều cao mỗi lần gõ.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    // PHẢI CỘNG BỀ DÀY VIỀN: app dùng box-sizing border-box nên `height` bao gồm cả viền, còn
    // scrollHeight thì không — gán thẳng scrollHeight là viền ăn mất ~2px, cắt cụt dòng cuối.
    const css = getComputedStyle(el);
    const vien = (parseFloat(css.borderTopWidth) || 0) + (parseFloat(css.borderBottomWidth) || 0);
    el.style.height = `${el.scrollHeight + vien}px`;
  }, [rest.value]);

  return (
    <textarea
      {...rest}
      ref={ref}
      rows={minRows}
      className={cn('resize-none overflow-hidden', className)}
    />
  );
}
