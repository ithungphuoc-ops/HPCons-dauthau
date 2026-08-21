'use client';

// GiftPopup — khung điện thoại nhúng iframe "Quà của tôi" (quacuatoi.hpcore.vn), thay cho việc
// mở tab mới. Phỏng theo thiết kế GiftPopup.tsx đã duyệt ở hpcons-portal (nhiều vòng phản hồi
// thật với Sếp), thích ứng lại cho app này:
//   - App này KHÔNG dùng next/navigation hay react-router — toàn bộ điều hướng là state nội bộ
//     (activeTab) trong src/App.tsx (SPA client-nặng chạy dưới Next.js với ssr:false, xem
//     app/ErpAppLoader.tsx). Vì vậy "Trang chủ" nhận vào một callback (onGoHome) do App.tsx
//     truyền xuống, thay vì tự gọi router.push('/').
//   - App này chưa có trang "Thông báo" / "Tôi" riêng (chuông thông báo chỉ là dropdown, còn
//     "Hồ sơ" ở đây nghĩa là hồ sơ dự thầu chứ không phải trang cá nhân) → KHÔNG bịa thêm 2 mục
//     đó, chỉ giữ 3 mục có thật: Trang chủ, Làm mới, Mở tab đầy đủ.
//   - Màu nổi bật dùng đúng token primary của app này (--color-brand-primary = #096AA7, xem
//     app/globals.css), không hardcode bg-hp-primary (token riêng của hpcons-portal).
import { useRef } from 'react';
import { X, RotateCw, ExternalLink, Home, type LucideIcon } from 'lucide-react';
import { useModalA11y } from '../utils/useModalA11y';

const QUA_CUA_TOI_URL = 'https://quacuatoi.hpcore.vn';

function MucDieuHuong({ icon: Icon, label, title, onClick, noiBat }: { icon: LucideIcon; label: string; title?: string; onClick: () => void; noiBat?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title ?? label}
      className={`flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-semibold transition-colors active:scale-95 ${noiBat ? 'text-brand-primary' : 'text-slate-500 hover:text-slate-700'}`}
    >
      <Icon size={20} />
      <span>{label}</span>
    </button>
  );
}

export default function GiftPopup({ onClose, onGoHome }: { onClose: () => void; onGoHome: () => void }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // Focus trap + khoá Esc/scroll nền — hook dùng chung của app (docs/design-system/13-overlays).
  const dialogRef = useModalA11y(onClose);

  const veTrangChu = () => { onClose(); onGoHome(); };

  return (
    // CHỈ nút X (hoặc nút điều hướng) mới đóng được - KHÔNG đóng khi bấm nền tối, tránh mất
    // popup do lỡ tay khi đang thao tác trên khung điện thoại nhỏ.
    <div className="fixed inset-0 z-[60] flex items-center justify-center xl:p-4" style={{ background: 'rgba(10, 14, 22, 0.6)', backdropFilter: 'blur(3px)' }}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Quà của tôi"
        tabIndex={-1}
        className="relative shadow-2xl w-full h-full rounded-none p-0 outline-none xl:rounded-[3rem] xl:p-3.5 xl:w-[380px] xl:h-[min(800px,88vh)]"
        style={{ background: 'linear-gradient(155deg, #2a3040, #12151c)' }}
      >
        <button
          onClick={onClose}
          aria-label="Đóng"
          className="hidden xl:flex absolute -top-3.5 -right-3.5 w-10 h-10 rounded-full bg-white text-slate-700 border border-slate-200 shadow-lg items-center justify-center hover:scale-105 transition-transform"
        >
          <X size={18} />
        </button>
        <div className="relative w-full h-full bg-white overflow-hidden flex flex-col rounded-none xl:rounded-[2.25rem]">
          <div className="flex xl:hidden shrink-0 items-center justify-between gap-2 px-4 py-3 border-b border-slate-100 bg-white">
            <span className="text-sm font-bold text-slate-800">🎁 Quà của tôi</span>
            <button type="button" onClick={onClose} aria-label="Đóng" className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200 transition-colors">
              <X size={16} />
            </button>
          </div>
          <div className="relative h-11 shrink-0 bg-white hidden xl:block">
            <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-[118px] h-[26px] rounded-full bg-[#12151c] flex items-center justify-end pr-2.5">
              <span className="w-2 h-2 rounded-full bg-[#2a3040]" />
            </div>
          </div>
          <iframe ref={iframeRef} src={QUA_CUA_TOI_URL} title="Quà của tôi — điểm thưởng UrBox" className="flex-1 w-full border-0" loading="lazy" />
          <div className="grid grid-cols-3 shrink-0 border-t border-slate-100 bg-white">
            <MucDieuHuong icon={Home} label="Trang chủ" onClick={veTrangChu} />
            <MucDieuHuong icon={RotateCw} label="Làm mới" onClick={() => { if (iframeRef.current) iframeRef.current.src = QUA_CUA_TOI_URL; }} />
            <MucDieuHuong icon={ExternalLink} label="Mở tab" title="Mở tab đầy đủ" noiBat onClick={() => window.open(QUA_CUA_TOI_URL, '_blank', 'noopener,noreferrer')} />
          </div>
          <div className="relative h-5 shrink-0 bg-white hidden xl:block">
            <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-[120px] h-1 rounded-full bg-slate-900/20" />
          </div>
        </div>
      </div>
    </div>
  );
}
