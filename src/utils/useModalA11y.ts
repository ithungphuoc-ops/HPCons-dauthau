import { useEffect, useRef } from 'react';

/**
 * A11y cho Dialog (docs/design-system/13-overlays/dialog.md + 17-accessibility):
 * - Esc đóng hộp thoại (bỏ qua nếu không truyền onClose — vd: bắt buộc đổi mật khẩu lần đầu)
 * - Khóa phím Tab trong hộp thoại (focus trap)
 * - Khóa cuộn nền khi mở (13-overlays/drawer-bottom-sheet.md)
 * - Trả focus về phần tử đã mở khi đóng
 *
 * Cách dùng: const panelRef = useModalA11y(onClose);
 * Gắn ref vào DIV PANEL của hộp thoại (không phải lớp backdrop) kèm role="dialog" aria-modal="true" tabIndex={-1}.
 *
 * Tham số `active` (mặc định true): dùng khi hộp thoại render CÓ ĐIỀU KIỆN bên trong
 * một component đang mở sẵn — truyền state mở/đóng vào để trap kích hoạt đúng lúc.
 */
export function useModalA11y(onClose?: () => void, active: boolean = true) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Giữ onClose trong ref để effect chỉ chạy 1 lần khi mở modal
  // (nếu không, arrow function mới ở mỗi render sẽ làm focus nhảy về đầu liên tục)
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active) return;
    const panel = panelRef.current;
    if (!panel) return;
    const opener = document.activeElement as HTMLElement | null;

    // Khóa cuộn nền
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const getFocusables = (): HTMLElement[] => {
      const nodes = panel.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const els: HTMLElement[] = [];
      nodes.forEach(el => {
        if (!el.hasAttribute('disabled') && el.offsetParent !== null) els.push(el);
      });
      return els;
    };

    // Đưa focus vào hộp thoại khi mở
    (getFocusables()[0] ?? panel).focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (onCloseRef.current) {
          e.stopPropagation();
          onCloseRef.current();
        }
        return;
      }
      if (e.key !== 'Tab') return;
      const els = getFocusables();
      if (!els.length) {
        e.preventDefault();
        return;
      }
      const first = els[0];
      const last = els[els.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = prevOverflow;
      opener?.focus();
    };
  }, [active]);

  return panelRef;
}
