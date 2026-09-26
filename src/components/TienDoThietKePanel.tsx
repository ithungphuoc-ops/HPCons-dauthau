'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Search, RefreshCw, PencilRuler } from 'lucide-react';
import { EmptyState } from './ui/EmptyState';
import { fmtDateTimeVN, MUI_GIO_VN } from '../utils/dateVN';
import type { DongTienDoThietKe, TienDoThietKeChiTiet } from '../lib/tienDoThietKeChiTietTypes';
import { chuanHoaMaDuAn } from '../lib/maPhongBan';

/**
 * KHUNG "TIẾN ĐỘ THIẾT KẾ — PHÒNG THIẾT KẾ" — tab "Liên kết phòng ban"
 * (OpenSpec `lien-ket-thiet-ke-dau-thau`, SỬA 26/09/2026 THEO DEMO BẢN 02 Sếp duyệt:
 *  "nguyên tiến độ này sẽ qua phòng đấu thầu nằm ở mục chỗ ảnh này")
 *
 * Trưởng nhóm Thiết kế bấm "Share sang Đấu thầu" ở trang Tiến độ → App Thiết kế gửi MỌI dự án
 * đang hiện (kể cả chưa gắn mã) qua /api/webhook/tien-do-thiet-ke-chi-tiet. Khung này dựng lại
 * NGUYÊN trang Tiến độ đó: gom theo dự án, bấm để mở từng công việc, đủ cột, thanh Gantt theo tuần,
 * vạch "Hôm nay". CHỈ XEM — tiến độ do Phòng Thiết kế làm chủ, muốn đổi thì bên đó sửa rồi Share lại.
 *
 * Giao diện bám `src/modules/timeline/` của App Thiết kế (cột, nhãn tuần dd-MM, màu theo người),
 * nhưng dùng lớp Tailwind sáng/tối của app này thay token riêng bên kia.
 *
 * ĐÃ BỎ so với bản 01: khối "Tiến độ chi tiết công việc" theo từng mã, và bảng tóm tắt đọc từ
 * /api/tien-do-thiet-ke (cổng Bearer cũ — ROUTE GIỮ NGUYÊN, chỉ gỡ khỏi giao diện).
 */

type Props = {
  /** Dữ liệu dựng sẵn cho Bản thử. Có giá trị thì KHÔNG gọi API (bản thử không đụng dữ liệu thật). */
  duLieuBanThu?: TienDoThietKeChiTiet[];
  /**
   * Chỉ cho xem những mã dự án này. `null`/bỏ trống = xem hết.
   * Chuyên viên (Level 3): chỉ thấy dự án ĐÃ GẮN MÃ thuộc gói mình được giao — dự án chưa mã
   * không biết thuộc gói nào nên ẩn (máy chủ đã lọc cùng luật, đây là lớp thứ hai + cho Bản thử).
   */
  chiMaDuAn?: string[] | null;
};

// ===== NGÀY THÁNG =====
// Bên Thiết kế gửi ISO đủ giờ (Timestamp → toISOString, tức giờ UTC). Cắt 10 ký tự đầu sẽ LỆCH
// MỘT NGÀY với mốc 0h giờ Việt Nam (0h 10/08 VN = 17h 09/08 UTC) → quy mọi mốc về ngày theo
// giờ Việt Nam rồi mới tính.
const dinhDangNgayVN = new Intl.DateTimeFormat('en-CA', { timeZone: MUI_GIO_VN, year: 'numeric', month: '2-digit', day: '2-digit' });
const MS_NGAY = 86_400_000;

/** Chuỗi ngày/ISO → số thứ tự ngày (tính từ 1970-01-01) theo lịch Việt Nam; không đọc được → null. */
const soNgayCua = (s?: string): number | null => {
  if (!s) return null;
  let ymd = /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
  if (!ymd) {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return null;
    ymd = dinhDangNgayVN.format(d);
  }
  const [y, m, d] = ymd.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / MS_NGAY);
};
const homNay = (): number => soNgayCua(new Date().toISOString()) as number;
/**
 * Ngày ngoài ±3 năm quanh hôm nay coi như không đọc được (CodeRabbit PR #13): một dòng gửi nhầm
 * `9999-12-31` sẽ kéo trục Gantt ra hàng triệu px và treo trình duyệt của cả phòng. Ngày kết thúc
 * trước ngày bắt đầu thì lấy bằng ngày bắt đầu, để thanh không âm và số ngày không âm.
 */
const GIOI_HAN_NGAY = 3 * 366;
const ngayHopLe = (n: number | null, hn: number): number | null =>
  n != null && Math.abs(n - hn) <= GIOI_HAN_NGAY ? n : null;
const chuanHoaKhoang = (bdTho: number | null, ktTho: number | null): { bd: number | null; kt: number | null } => {
  const hn = homNay();
  const bd = ngayHopLe(bdTho, hn);
  let kt = ngayHopLe(ktTho, hn);
  if (bd != null && kt != null && kt < bd) kt = bd;
  return { bd, kt };
};
const tuSoNgay = (n: number): Date => new Date(n * MS_NGAY);
const pad = (n: number) => String(n).padStart(2, '0');
/** dd/MM/yy như bảng bên Thiết kế. */
const nhanNgay = (n: number | null): string => {
  if (n == null) return '—';
  const d = tuSoNgay(n);
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${String(d.getUTCFullYear()).slice(2)}`;
};
/** dd-MM cho nhãn tuần trên trục Gantt. */
const nhanTuan = (n: number): string => {
  const d = tuSoNgay(n);
  return `${pad(d.getUTCDate())}-${pad(d.getUTCMonth() + 1)}`;
};

// ===== MÀU =====
// Bảng màu phân loại theo người, cùng họ màu bên Thiết kế (TimelineLegend/getPersonColor). Bên này
// chỉ nhận TÊN (không nhận email — design.md quyết định 6) nên băm theo tên: màu có thể khác bên
// Thiết kế, nhưng ổn định giữa các lần mở và cùng một người luôn cùng một màu trong khung này.
const MAU_NGUOI = [
  'bg-blue-500', 'bg-orange-500', 'bg-pink-500', 'bg-emerald-500', 'bg-purple-500', 'bg-cyan-500',
  'bg-amber-500', 'bg-rose-500', 'bg-indigo-500', 'bg-teal-500', 'bg-lime-600', 'bg-fuchsia-500',
];
const MAU_DU_AN = [
  'bg-cyan-50 text-cyan-700 ring-cyan-300 dark:bg-cyan-500/10 dark:text-cyan-300 dark:ring-cyan-500/40',
  'bg-orange-50 text-orange-700 ring-orange-300 dark:bg-orange-500/10 dark:text-orange-300 dark:ring-orange-500/40',
  'bg-violet-50 text-violet-700 ring-violet-300 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/40',
  'bg-emerald-50 text-emerald-700 ring-emerald-300 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/40',
  'bg-sky-50 text-sky-700 ring-sky-300 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/40',
  'bg-pink-50 text-pink-700 ring-pink-300 dark:bg-pink-500/10 dark:text-pink-300 dark:ring-pink-500/40',
];
const bam = (s: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
};
const mauNguoi = (ten: string) => (ten ? MAU_NGUOI[bam(ten) % MAU_NGUOI.length] : 'bg-slate-400');
const mauDuAn = (ten: string) => MAU_DU_AN[bam(ten) % MAU_DU_AN.length];

// Tình trạng: bên Thiết kế có thể gửi mã (todo/in_progress/done/paused) hoặc chữ — hiện chữ Việt.
const NHAN_TINH_TRANG: Record<string, string> = {
  todo: 'Cần làm', in_progress: 'Đang làm', done: 'Hoàn thành', paused: 'Tạm dừng',
};
const nhanTinhTrang = (s: string) => NHAN_TINH_TRANG[s] || s || '—';
const laXong = (s: string) => s === 'done' || /hoàn thành|xong/i.test(s || '');
const TAG = 'inline-block whitespace-nowrap rounded-md px-2 py-0.5 text-[10px] font-bold';
const mauTinhTrang = (s: string, treHan: boolean): string => {
  if (treHan) return 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300';
  if (laXong(s)) return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300';
  if (s === 'in_progress' || /đang/i.test(s || '')) return 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300';
  if (s === 'paused' || /dừng/i.test(s || '')) return 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300';
  return 'bg-slate-100 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300';
};

// ===== GANTT =====
const RONG_NGAY = 12; // px/ngày — đúng mức zoom "tuần" bên Thiết kế

type Dong = DongTienDoThietKe & { bd: number | null; kt: number | null };
type Nhom = {
  khoa: string;
  ma: string;
  ten: string;
  dong: Dong[];
  bd: number | null;
  kt: number | null;
  soTre: number;
};

export default function TienDoThietKePanel({ duLieuBanThu, chiMaDuAn }: Props) {
  const [items, setItems] = useState<TienDoThietKeChiTiet[]>(duLieuBanThu || []);
  const [soBiAnMayChu, setSoBiAnMayChu] = useState(0);
  const [dangTai, setDangTai] = useState(!duLieuBanThu);
  const [thongBao, setThongBao] = useState('');
  const [tim, setTim] = useState('');
  const [moRong, setMoRong] = useState<Record<string, boolean>>({});
  const [lanTai, setLanTai] = useState(0);

  useEffect(() => {
    // Bản thử: dùng dữ liệu dựng sẵn, TUYỆT ĐỐI không gọi API (quy ước DEV_SANDBOX ở App.tsx).
    if (duLieuBanThu) { setItems(duLieuBanThu); setSoBiAnMayChu(0); setDangTai(false); return; }
    let huy = false;
    setDangTai(true);
    (async () => {
      try {
        const res = await fetch('/api/tien-do-thiet-ke-chi-tiet', { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (huy) return;
        setItems(Array.isArray(data?.items) ? data.items : []);
        setSoBiAnMayChu(typeof data?.soBiAn === 'number' ? data.soBiAn : 0);
        setThongBao(data?.thongBao || (res.ok ? '' : 'Không đọc được tiến độ thiết kế.'));
      } catch {
        if (!huy) setThongBao('Không đọc được tiến độ thiết kế.');
      } finally {
        if (!huy) setDangTai(false);
      }
    })();
    return () => { huy = true; };
  }, [duLieuBanThu, lanTai]);

  // Thu hẹp theo phạm vi được xem TRƯỚC mọi thứ khác (ô tìm, số đếm, dòng "chia sẻ lúc").
  const choXem = useMemo(
    () => (chiMaDuAn ? new Set(chiMaDuAn.map(chuanHoaMaDuAn).filter(Boolean)) : null),
    [chiMaDuAn],
  );
  const duocXem = useMemo(() => {
    if (!choXem) return items;
    return items.filter(x => {
      const ma = chuanHoaMaDuAn(x.maDuAn);
      return !!ma && choXem.has(ma);
    });
  }, [items, choXem]);
  const soBiAn = soBiAnMayChu + (items.length - duocXem.length);

  // Lần chia sẻ MỚI NHẤT (mỗi dự án một sự kiện nên các bản có thể lệch nhau vài giây).
  const moiNhat = useMemo(
    () => duocXem.reduce<TienDoThietKeChiTiet | null>((m, x) => (!m || (x.sharedAt || '') > (m.sharedAt || '') ? x : m), null),
    [duocXem],
  );

  const nhom = useMemo<Nhom[]>(() => duocXem.map(x => {
    const dong: Dong[] = (x.rows || []).map(r => ({ ...r, ...chuanHoaKhoang(soNgayCua(r.startDate), soNgayCua(r.endDate)) }));
    const bds = dong.map(d => d.bd).filter((n): n is number => n != null);
    const kts = dong.map(d => d.kt ?? d.bd).filter((n): n is number => n != null);
    return {
      khoa: x.khoaDuAn,
      ma: x.maDuAn || '',
      ten: x.tenDuAn || '',
      dong,
      bd: bds.length ? Math.min(...bds) : null,
      kt: kts.length ? Math.max(...kts) : null,
      soTre: dong.filter(d => d.overdue).length,
    };
  }), [duocXem]);

  const q = tim.trim().toLowerCase();
  const hienThi = useMemo<Nhom[]>(() => {
    if (!q) return nhom;
    const out: Nhom[] = [];
    for (const n of nhom) {
      // Trúng mã/tên dự án → giữ cả dự án; không thì chỉ giữ công việc trúng tên/người thực hiện.
      if (n.ma.toLowerCase().includes(q) || n.ten.toLowerCase().includes(q)) { out.push(n); continue; }
      const dong = n.dong.filter(d => (d.title || '').toLowerCase().includes(q) || (d.assigneeName || '').toLowerCase().includes(q));
      if (dong.length) out.push({ ...n, dong, soTre: dong.filter(d => d.overdue).length });
    }
    return out;
  }, [nhom, q]);

  // Khung trục thời gian: từ ngày sớm nhất → muộn nhất của mọi dự án đang hiện, LUÔN chừa quanh
  // "hôm nay" (−3/+7 ngày, như bên Thiết kế) để vạch Hôm nay không lọt ra ngoài; căn về thứ Hai
  // để mỗi nhãn là ngày đầu tuần.
  const truc = useMemo(() => {
    const hn = homNay();
    let a = hn - 3, b = hn + 7;
    for (const n of hienThi) {
      if (n.bd != null) a = Math.min(a, n.bd);
      if (n.kt != null) b = Math.max(b, n.kt);
    }
    a -= (tuSoNgay(a).getUTCDay() + 6) % 7;          // lùi về thứ Hai
    b += 6 - ((tuSoNgay(b).getUTCDay() + 6) % 7);    // tới Chủ nhật
    const soNgay = b - a + 1;
    const tuan: number[] = [];
    for (let i = 0; i < soNgay; i += 7) tuan.push(a + i);
    return { a, rong: soNgay * RONG_NGAY, tuan, homNay: (hn - a) * RONG_NGAY };
  }, [hienThi]);

  const nguoi = useMemo(
    () => Array.from(new Set(hienThi.flatMap(n => n.dong.map(d => d.assigneeName)).filter(Boolean))).sort((x, y) => x.localeCompare(y, 'vi')),
    [hienThi],
  );
  const tongViec = duocXem.reduce((s, x) => s + (x.rows?.length || 0), 0);

  const oGantt = (bd: number | null, kt: number | null, mau: string, tre: boolean) => (
    <div className="relative h-3.5" style={{ width: truc.rong }}>
      <div className="absolute -top-2 -bottom-2 w-0.5 bg-rose-500" style={{ left: truc.homNay }} />
      {bd != null && (
        <div
          className={`absolute top-0 h-3.5 rounded ${mau} ${tre ? 'ring-2 ring-rose-500/70' : ''}`}
          style={{ left: (bd - truc.a) * RONG_NGAY, width: Math.max(((kt ?? bd) - bd + 1) * RONG_NGAY, RONG_NGAY) }}
          title={`${nhanNgay(bd)} → ${nhanNgay(kt ?? bd)}`}
        />
      )}
    </div>
  );

  const soNgayViec = (bd: number | null, kt: number | null) => (bd != null && kt != null ? `${kt - bd + 1} ngày` : '—');
  const o = 'px-3 py-2 align-middle whitespace-nowrap';
  const dauCot = 'px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap';
  const chuNgay = (tre: boolean) => `${o} text-[11px] tabular-nums ${tre ? 'font-semibold text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-300'}`;
  const doiMo = (khoa: string) => setMoRong(s => ({ ...s, [khoa]: !s[khoa] }));

  return (
    <div className="min-w-0 bg-white dark:bg-dark-card rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4 mb-4">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <PencilRuler className="w-4 h-4 text-brand-accent dark:text-brand-accent-300" />
            Tiến độ thiết kế — Phòng Thiết kế
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">Dữ liệu do App Thiết kế chia sẻ sang. (Chỉ xem)</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <div className="relative min-w-0">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              value={tim}
              onChange={e => setTim(e.target.value)}
              placeholder="Tìm mã, tên dự án, công việc..."
              className="pl-8 pr-3 py-1.5 w-56 max-w-full border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-dark-elevated text-slate-700 dark:text-slate-200 focus:ring-brand-accent"
            />
          </div>
          {!duLieuBanThu && (
            <button
              type="button"
              onClick={() => setLanTai(n => n + 1)}
              title="Tải lại"
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-brand-accent hover:border-brand-accent transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${dangTai ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {thongBao && (
        <div className="mb-4 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 text-[11px] font-medium text-amber-800 dark:text-amber-300">
          {thongBao}
        </div>
      )}

      {moiNhat && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
          Thiết kế chia sẻ lúc <b className="text-slate-700 dark:text-slate-200">{moiNhat.sharedAt ? fmtDateTimeVN(moiNhat.sharedAt) : '—'}</b>
          {' '}bởi <b className="text-slate-700 dark:text-slate-200">{moiNhat.sharedByName || '—'}</b>
          {' '}· {duocXem.length} dự án · {tongViec} công việc
        </p>
      )}

      {soBiAn > 0 && (
        <div className="mb-3 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-4 py-2.5 text-[11px] font-medium text-amber-800 dark:text-amber-300">
          Chuyên viên chỉ thấy dự án đã gắn mã thuộc gói mình được giao. Đang ẩn {soBiAn} dự án chưa có mã hoặc không thuộc gói của bạn.
        </div>
      )}

      {dangTai && duocXem.length === 0 ? (
        <div className="py-10 text-center text-xs text-slate-400">Đang tải tiến độ thiết kế...</div>
      ) : duocXem.length === 0 ? (
        <EmptyState
          icon={<PencilRuler className="w-6 h-6" />}
          title={soBiAn > 0 ? 'Chưa có tiến độ thiết kế cho gói thầu của bạn' : 'Phòng Thiết kế chưa chia sẻ tiến độ'}
          description={soBiAn > 0
            ? 'Khung này chỉ hiện dự án đã gắn mã thuộc gói thầu bạn được giao việc.'
            : 'Bên Thiết kế bấm "Share sang Đấu thầu" ở trang Tiến độ thì khung này tự có dữ liệu.'}
        />
      ) : hienThi.length === 0 ? (
        <EmptyState
          icon={<Search className="w-6 h-6" />}
          title="Không có dự án nào khớp"
          description="Thử bỏ bớt từ khoá tìm kiếm."
        />
      ) : (
        <>
          {nguoi.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-slate-100 dark:border-slate-800 px-3 py-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Màu theo người</span>
              {nguoi.map(n => (
                <span key={n} className="inline-flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${mauNguoi(n)}`} />
                  {n}
                </span>
              ))}
            </div>
          )}

          {/* Bảng rộng hơn màn hình (9 cột + Gantt): cuộn ngang TRONG khung, trang không tràn. */}
          <div className="max-w-full overflow-x-auto rounded-lg border border-slate-100 dark:border-slate-800">
            <table className="border-collapse" style={{ width: 'max-content', minWidth: '100%' }}>
              <thead>
                <tr className="bg-slate-50 dark:bg-dark-elevated/50">
                  <th className={dauCot}>Mã dự án</th>
                  <th className={dauCot}>Dự án</th>
                  <th className={dauCot}>Tên công việc</th>
                  <th className={dauCot}>Người thực hiện</th>
                  <th className={dauCot}>Thời gian</th>
                  <th className={dauCot}>Ngày bắt đầu</th>
                  <th className={dauCot}>Ngày kết thúc</th>
                  <th className={dauCot}>Tình trạng</th>
                  <th className={dauCot}>Nội dung thay đổi</th>
                  <th className="px-0 py-2">
                    <div className="relative h-5" style={{ width: truc.rong }}>
                      {truc.tuan.map(t => (
                        <span
                          key={t}
                          className="absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-[10px] font-semibold text-slate-400"
                          style={{ left: (t - truc.a) * RONG_NGAY + 2 }}
                        >
                          {nhanTuan(t)}
                        </span>
                      ))}
                      <span
                        className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-rose-500 px-1 py-0.5 text-[9px] font-bold text-white"
                        style={{ left: truc.homNay }}
                      >
                        Hôm nay
                      </span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {hienThi.map(n => {
                  // Đang tìm thì mở sẵn — trúng theo tên công việc mà vẫn đóng thì người dùng không thấy gì.
                  const mo = !!q || !!moRong[n.khoa];
                  const tre = n.soTre > 0;
                  const xongHet = n.dong.length > 0 && n.dong.every(d => laXong(d.status));
                  return (
                    <Fragment key={n.khoa}>
                      <tr
                        className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-dark-elevated/30 hover:bg-brand-accent/[0.04] cursor-pointer"
                        onClick={() => doiMo(n.khoa)}
                      >
                        <td className={o}>
                          {/* Nút riêng cho bàn phím/trình đọc màn hình (bài học CodeRabbit PR #11);
                              onClick ở <tr> vẫn cho chuột bấm cả hàng. */}
                          <button
                            type="button"
                            aria-expanded={mo}
                            onClick={e => { e.stopPropagation(); doiMo(n.khoa); }}
                            className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 dark:text-slate-200"
                          >
                            {mo ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                            {n.ma ? (
                              <span className="rounded-md bg-white dark:bg-dark-card px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ring-1 ring-inset ring-slate-200 dark:ring-slate-700">{n.ma}</span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </button>
                        </td>
                        <td className={o}>
                          <span className={`inline-flex max-w-[16rem] truncate rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset ${mauDuAn(n.ten)}`} title={n.ten}>
                            {n.ten || '—'}
                          </span>
                        </td>
                        <td className={`${o} text-[11px] text-slate-500 dark:text-slate-400`}>
                          ({n.dong.length})
                          {tre && (
                            <span className="ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold text-rose-600 dark:text-rose-400 ring-1 ring-inset ring-rose-300 dark:ring-rose-500/40">
                              {n.soTre} trễ hạn
                            </span>
                          )}
                        </td>
                        <td className={o} />
                        <td className={`${o} text-[11px] tabular-nums text-slate-600 dark:text-slate-300`}>{soNgayViec(n.bd, n.kt)}</td>
                        <td className={chuNgay(tre)}>{nhanNgay(n.bd)}</td>
                        <td className={chuNgay(tre)}>{nhanNgay(n.kt)}</td>
                        <td className={o}>
                          <span className={`${TAG} ${mauTinhTrang(xongHet ? 'done' : '', tre)}`}>
                            {tre ? 'Trễ hạn kế hoạch' : xongHet ? 'Hoàn thành' : 'Đang thực hiện'}
                          </span>
                        </td>
                        <td className={o} />
                        <td className="px-0 py-2">{oGantt(n.bd, n.kt, 'bg-slate-400 dark:bg-slate-500', false)}</td>
                      </tr>
                      {mo && n.dong.map(d => (
                        <tr key={`${n.khoa}-${d.source}-${d.id}`} className="border-t border-slate-100 dark:border-slate-800/60">
                          <td className={o} />
                          <td className={o} />
                          <td className={`${o} max-w-[16rem] truncate text-xs font-medium ${d.overdue ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-slate-100'}`} title={d.title}>
                            {d.title}
                          </td>
                          <td className={`${o} text-[11px] text-slate-600 dark:text-slate-300`}>
                            <span className="inline-flex items-center gap-1.5">
                              <span className={`h-2 w-2 shrink-0 rounded-full ${mauNguoi(d.assigneeName)}`} />
                              {d.assigneeName || '—'}
                            </span>
                          </td>
                          <td className={`${o} text-[11px] tabular-nums text-slate-600 dark:text-slate-300`}>{soNgayViec(d.bd, d.kt)}</td>
                          <td className={chuNgay(d.overdue)}>{nhanNgay(d.bd)}</td>
                          <td className={chuNgay(d.overdue)}>{nhanNgay(d.kt)}</td>
                          <td className={o}>
                            <span className={`${TAG} ${mauTinhTrang(d.status, d.overdue)}`}>{nhanTinhTrang(d.status)}</span>
                          </td>
                          <td className={`${o} max-w-[14rem] truncate text-[11px] text-slate-500 dark:text-slate-400`} title={d.changeNote}>
                            {d.changeNote || '—'}
                          </td>
                          <td className="px-0 py-2">{oGantt(d.bd, d.kt, mauNguoi(d.assigneeName), d.overdue)}</td>
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
