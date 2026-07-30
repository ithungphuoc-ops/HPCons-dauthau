import { useMemo } from 'react';
import { AppNotification, Staff } from '../types';
import { ChevronRight, Bell } from 'lucide-react';
import { getInitials, getInitialsColor } from '../App';

/**
 * Danh sách thông báo — dựng theo cách của Base cho dễ đọc (chị Trâm chốt 30/07/2026).
 *
 * Trước đây mỗi tin chỉ là một dòng chữ trơn xếp liên tiếp: không biết ai làm, không biết cách đây
 * bao lâu, tin cũ tin mới nhìn y như nhau nên phải đọc từng dòng mới nắm được chuyện gì.
 *
 * Bốn thứ học từ Base:
 *   1. GOM THEO NGÀY — mỗi mốc ngày một tiêu đề ("Hôm nay" / "Hôm qua" / ngày cụ thể), bên phải ghi
 *      "N ngày trước" để ước lượng nhanh mà không phải trừ ngày trong đầu.
 *   2. ẢNH NGƯỜI THAO TÁC ở đầu dòng — quét mắt theo ảnh nhanh hơn theo chữ.
 *   3. TIN CHƯA ĐỌC có nền nhạt + vạch màu bên trái, đọc rồi thì về nền trắng.
 *   4. Mỗi dòng có dấu ">" để thấy rõ là bấm được, kèm giờ-phút ở cuối.
 */

const MOT_NGAY = 86400000;

/** Đầu ngày (0h) theo giờ máy — dùng để gom nhóm và đếm "N ngày trước". */
const dauNgay = (v: string | Date): number => {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return NaN;
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const hai = (n: number) => String(n).padStart(2, '0');

export interface NotificationFeedProps {
  notifs: AppNotification[];
  staff: Staff[];
  /** Bấm vào một tin — parent quyết định đi đâu (mở hồ sơ / đổi tab). */
  onOpen: (n: AppNotification) => void;
}

export default function NotificationFeed({ notifs, staff, onOpen }: NotificationFeedProps) {
  // Gom theo ngày, ngày mới nhất lên đầu; trong mỗi ngày thì tin mới nhất lên trước.
  const nhom = useMemo(() => {
    const theoNgay = new Map<number, AppNotification[]>();
    [...notifs]
      .sort((a, b) => b.ngay.localeCompare(a.ngay))
      .forEach(n => {
        const key = dauNgay(n.ngay);
        if (Number.isNaN(key)) return;
        const danh = theoNgay.get(key);
        if (danh) danh.push(n);
        else theoNgay.set(key, [n]);
      });
    return [...theoNgay.entries()].sort((a, b) => b[0] - a[0]);
  }, [notifs]);

  if (notifs.length === 0) {
    return <div className="p-6 text-center text-xs text-slate-400 dark:text-slate-500">Không có thông báo nào 🎉</div>;
  }

  const homNay = dauNgay(new Date());

  return (
    <div>
      {nhom.map(([ngay, tin]) => {
        const cachMayNgay = Math.round((homNay - ngay) / MOT_NGAY);
        const d = new Date(ngay);
        const nhanNgay = cachMayNgay === 0 ? 'Hôm nay'
          : cachMayNgay === 1 ? 'Hôm qua'
            : `${hai(d.getDate())}/${hai(d.getMonth() + 1)}/${d.getFullYear()}`;
        const nhanCach = cachMayNgay === 0 ? '' : cachMayNgay === 1 ? '1 ngày trước' : `${cachMayNgay} ngày trước`;
        return (
          <div key={ngay}>
            {/* Dải mốc ngày — dính lại khi cuộn để lúc nào cũng biết đang đọc tin của ngày nào */}
            {/* Cỡ chữ GIỮ ĐÚNG THANG CỦA APP (chị Trâm chốt 30/07/2026 — thử phóng 1.25 lần thấy to
                quá, không ăn nhập với các khung khác). Dễ đọc là nhờ khung rộng và bố cục,
                không phải nhờ phóng chữ. */}
            <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-1.5 bg-slate-50 dark:bg-dark-elevated/90 border-y border-slate-100 dark:border-slate-800 backdrop-blur">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">{nhanNgay}</span>
              {nhanCach && <span className="ml-auto text-[10px] font-semibold text-slate-400 dark:text-slate-500">{nhanCach}</span>}
            </div>
            <ul>
              {tin.map(n => {
                const nguoi = n.actorId ? staff.find(s => s.id === n.actorId) : undefined;
                const gio = new Date(n.ngay);
                const gioVN = `${hai(gio.getHours())}:${hai(gio.getMinutes())}`;
                const chuaDoc = !n.daDoc;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => onOpen(n)}
                      className={`group w-full text-left flex items-start gap-3 px-4 py-3 border-l-2 transition-colors cursor-pointer ${
                        chuaDoc
                          ? 'border-brand-accent bg-brand-accent/5 dark:bg-brand-accent/10 hover:bg-brand-accent/10 dark:hover:bg-brand-accent/15'
                          : 'border-transparent hover:bg-slate-50 dark:hover:bg-dark-elevated/60'
                      }`}
                    >
                      {/* Ảnh người thao tác; tin hệ thống (nhắc hạn) thì để biểu tượng chuông */}
                      {nguoi?.avatar ? (
                        <img src={nguoi.avatar} alt="" className="w-8 h-8 rounded-full object-cover shrink-0 mt-0.5" />
                      ) : nguoi ? (
                        <span className={`w-8 h-8 rounded-full shrink-0 mt-0.5 flex items-center justify-center text-[10px] font-black border ${getInitialsColor(nguoi.hoTen)}`}>
                          {getInitials(nguoi.hoTen)}
                        </span>
                      ) : (
                        <span className="w-8 h-8 rounded-full shrink-0 mt-0.5 flex items-center justify-center bg-brand-warning/15 text-brand-warning">
                          <Bell className="w-4 h-4" />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        {/* Tên người thao tác tách riêng dòng trên cho dễ quét, giống Base */}
                        <span className="block text-[11px] font-black text-slate-800 dark:text-slate-100 truncate">
                          {nguoi ? nguoi.hoTen : 'Hệ thống nhắc'}
                        </span>
                        <span className={`block text-[11px] leading-snug mt-0.5 ${
                          chuaDoc ? 'font-bold text-slate-700 dark:text-slate-200' : 'font-medium text-slate-500 dark:text-slate-400'
                        }`}>
                          {n.text}
                        </span>
                        <span className="block text-[9px] text-slate-400 dark:text-slate-500 mt-1">{gioVN}</span>
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 shrink-0 mt-1 text-slate-300 dark:text-slate-600 group-hover:text-brand-accent transition-colors" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
