'use client';

import { useState } from 'react';
import { RefreshCw, Send } from 'lucide-react';
import { goiDongBoThietKe } from '../lib/dongBoThietKeClient';

/**
 * NÚT "ĐỒNG BỘ LẠI SANG THIẾT KẾ" — chỉ Trưởng phòng (BOOD) thấy (OpenSpec
 * `lien-ket-thiet-ke-dau-thau`, Sếp duyệt 26/09/2026).
 *
 * Bình thường app tự gửi sau mỗi lần lưu dự án; nút này để (1) nạp một lượt các dự án đang có khi
 * mới bật liên kết, (2) gửi lại những dự án lần trước lỗi. Gọi CÙNG route với lần tự gửi — route
 * so dấu vân tay nên dự án không đổi sẽ không bị bắn lặp.
 */

type Props = {
  /** Bản thử: không gọi máy chủ (quy ước DEV_SANDBOX — không đụng dữ liệu thật). */
  banThu?: boolean;
};

export default function DongBoThietKeNut({ banThu }: Props) {
  const [dangChay, setDangChay] = useState(false);
  const [ketQua, setKetQua] = useState('');
  const [laLoi, setLaLoi] = useState(false);

  const bam = async () => {
    if (banThu) {
      setLaLoi(false);
      setKetQua('Bản thử: không gửi dữ liệu thật sang App Thiết kế.');
      return;
    }
    setDangChay(true);
    setKetQua('');
    try {
      const kq = await goiDongBoThietKe();
      if (kq.chuaCauHinh) {
        setLaLoi(true);
        setKetQua(kq.thongBao || 'Chưa cấu hình liên kết với App Thiết kế.');
        return;
      }
      const soLoi = typeof kq.loi === 'number' ? kq.loi : 0;
      const dsLoi = (kq.chiTietLoi || []).map(x => x.projectCode).join(', ');
      setLaLoi(soLoi > 0);
      setKetQua(
        `Đã gửi ${kq.daGui || 0} dự án · ${kq.khongDoi || 0} không đổi · ${kq.boQua || 0} bỏ qua (mã không thuộc Phòng Đấu thầu hoặc thiếu tên) · ${soLoi} lỗi`
        + (dsLoi ? ` (${dsLoi})` : ''),
      );
    } catch (e) {
      setLaLoi(true);
      setKetQua(`Không đồng bộ được: ${e instanceof Error ? e.message : 'lỗi kết nối'}`);
    } finally {
      setDangChay(false);
    }
  };

  return (
    <div className="bg-white dark:bg-dark-card rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs px-4 py-3 sm:px-6 flex flex-wrap items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-slate-800 dark:text-slate-100">Gửi dự án sang App Thiết kế</p>
        <p className="text-[11px] text-slate-400">
          Chỉ dự án mã dạng YY10xx-HPCS, gồm mã, tên và vị trí. App tự gửi sau khi lưu; bấm để gửi lại dự án lỗi hoặc chưa gửi.
        </p>
      </div>
      <button
        type="button"
        onClick={bam}
        disabled={dangChay}
        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-brand-accent text-white text-xs font-bold hover:opacity-90 disabled:opacity-60 transition-opacity"
      >
        {dangChay ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
        Đồng bộ lại sang Thiết kế
      </button>
      {ketQua && (
        <p
          role="status"
          className={`basis-full text-[11px] font-medium ${laLoi ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}`}
        >
          {ketQua}
        </p>
      )}
    </div>
  );
}
