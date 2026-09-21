'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Search, RefreshCw, PencilRuler, AlertTriangle, X } from 'lucide-react';
import { EmptyState } from './ui/EmptyState';
import { namHienTaiVN, fmtDateTimeVN } from '../utils/dateVN';
import type { DuAnThietKe, HangMucThietKe } from '../lib/tienDoThietKeTypes';

/**
 * BẢNG TIẾN ĐỘ THIẾT KẾ — tab "Liên kết phòng ban" (chị Trâm chốt 15/09/2026)
 *
 * "Đây là giao diện của app thiết kế, em thiết kế lại chỗ liên kết phòng ban đưa tiến độ này qua,
 *  BỎ ĐI vị trí lưu file, chỗ dự án phía trước THÊM CỘT MÃ DỰ ÁN."
 *
 * Thứ tự liên kết chị Trâm chốt: App Thông tin dự án đổ MÃ DỰ ÁN sang trước, rồi bấm vào mã đó để
 * xổ TIẾN ĐỘ THIẾT KẾ bên App Thiết kế. Nên bảng này lấy mã dự án làm cột đầu và làm chỗ bấm.
 *
 * Dữ liệu vào từ /api/tien-do-thiet-ke — đọc thứ App Thiết kế ĐẨY sang qua webhook. Bảng này CHỈ
 * XEM, không sửa: tiến độ thiết kế do Phòng Thiết kế làm chủ, Phòng Đấu thầu sửa vào là hai bên
 * lệch số ngay.
 */

type Props = {
  /** Dữ liệu dựng sẵn cho Bản thử. Có giá trị thì KHÔNG gọi API (bản thử không đụng dữ liệu thật). */
  duLieuBanThu?: DuAnThietKe[];
  /**
   * Chỉ cho xem những mã dự án này. `null`/bỏ trống = xem hết.
   * Dùng cho Chuyên viên (Level 3): họ chỉ thấy tiến độ thiết kế của gói thầu mình được giao việc.
   */
  chiMaDuAn?: string[] | null;
};

const dinhDangNgay = (s?: string): string => {
  if (!s) return '—';
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
};

/**
 * NĂM CỦA DỰ ÁN — lấy từ 4 CHỮ SỐ ĐẦU CỦA MÃ DỰ ÁN (chị Trâm chốt 19/09/2026)
 * "Liên kết short Năm với 4 chữ số đầu của mã dự án nhé em."
 * Dự phòng: mã nào bốn số đầu không ra năm hợp lệ thì lấy năm từ ngày lập dự án — xem ghi chú
 * đầy đủ ở DanhMucDuAnPanel.
 */
const namCua = (maDuAn?: string, ngay?: string): string => {
  const bon = (maDuAn || '').trim().slice(0, 4);
  const n = Number(bon);
  if (/^\d{4}$/.test(bon) && n >= 2000 && n <= 2100) return bon;
  return /^\d{4}/.test(ngay || '') ? (ngay as string).slice(0, 4) : '';
};

/** Màu nhãn tình trạng — bắt theo NGHĨA, vì chuỗi bên app kia gửi sang là chữ tự do. */
const mauTinhTrang = (t?: string): string => {
  const s = (t || '').toLowerCase();
  if (s.includes('hoàn thành') || s.includes('xong')) return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300';
  if (s.includes('trễ') || s.includes('quá hạn')) return 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300';
  if (s.includes('đang')) return 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300';
  return 'bg-slate-100 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300';
};

/**
 * Dự án đã xong hay chưa — dùng cho nút lọc "Đã xong / Đang làm".
 * Bắt theo chữ tình trạng bên App Thiết kế gửi sang; app kia không gửi tình trạng thì xét theo
 * các hạng mục: xong hết thì dự án mới coi là xong.
 */
const daXong = (d: DuAnThietKe): boolean => {
  const t = (d.tinhTrang || '').toLowerCase();
  if (t) return t.includes('hoàn thành') || t.includes('xong');
  const hm = d.hangMuc || [];
  if (hm.length === 0) return false;
  return hm.every(h => {
    const th = (h.tinhTrang || '').toLowerCase();
    return th.includes('hoàn thành') || th.includes('xong');
  });
};

const OTreHan = ({ so }: { so?: number }) => {
  const n = so || 0;
  if (n <= 0) return <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">Đúng hạn</span>;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400">
      <AlertTriangle className="w-3 h-3" />
      {n} ngày
    </span>
  );
};

export default function TienDoThietKePanel({ duLieuBanThu, chiMaDuAn }: Props) {
  const [items, setItems] = useState<DuAnThietKe[]>(duLieuBanThu || []);
  const [dangTai, setDangTai] = useState(!duLieuBanThu);
  const [thongBao, setThongBao] = useState('');
  const [capNhatLuc, setCapNhatLuc] = useState('');
  const [tim, setTim] = useState('');
  // MẶC ĐỊNH lọc theo NĂM HIỆN TẠI (chị Trâm chốt 15/09/2026: "mặc định theo từng năm cho gọn") —
  // đúng quy ước đã dùng ở Kanban, Gantt và Dashboard. Năm lấy theo giờ Việt Nam, không theo giờ
  // máy, và tự đổi theo lịch nên sang 2027 không phải sửa code.
  const [nam, setNam] = useState<string>(() => namHienTaiVN());
  const [tuNgay, setTuNgay] = useState('');
  const [denNgay, setDenNgay] = useState('');
  const [tinhTrang, setTinhTrang] = useState<'TAT_CA' | 'DANG_LAM' | 'DA_XONG'>('TAT_CA');
  const [moRong, setMoRong] = useState<Record<string, boolean>>({});
  const [lanTai, setLanTai] = useState(0);

  useEffect(() => {
    // Bản thử: dùng dữ liệu dựng sẵn, TUYỆT ĐỐI không gọi API (quy ước DEV_SANDBOX ở App.tsx).
    if (duLieuBanThu) { setItems(duLieuBanThu); setDangTai(false); return; }
    let huy = false;
    setDangTai(true);
    (async () => {
      try {
        const res = await fetch('/api/tien-do-thiet-ke', { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (huy) return;
        setItems(Array.isArray(data?.items) ? data.items : []);
        setCapNhatLuc(data?.capNhatLuc || '');
        setThongBao(data?.thongBao || (res.ok ? '' : 'Không đọc được tiến độ thiết kế.'));
      } catch {
        if (!huy) setThongBao('Không gọi được App Thiết kế.');
      } finally {
        if (!huy) setDangTai(false);
      }
    })();
    return () => { huy = true; };
  }, [duLieuBanThu, lanTai]);

  // Danh sách năm lấy theo NGÀY LẬP DỰ ÁN (chị Trâm chốt 15/09/2026), không dùng chuỗi năm tài
  // chính bên App Thiết kế gửi sang: chuỗi đó dạng "2026-2027" nên đọc lên không biết là năm nào,
  // trong khi người dùng chỉ cần chọn 2026 / 2027 / 2028.
  /**
   * Thu hẹp theo phạm vi được xem TRƯỚC mọi bộ lọc khác — mọi thứ phía sau (danh sách năm, số
   * đếm "n/N dự án", ô tìm kiếm) đều đọc từ đây, nên không có đường nào để lọt một mã dự án
   * ngoài phạm vi ra màn hình.
   */
  const duocXem = useMemo(() => {
    if (!chiMaDuAn) return items;
    const cho = new Set(chiMaDuAn.map(m => m.trim().toLowerCase()).filter(Boolean));
    return items.filter(d => cho.has((d.maDuAn || '').trim().toLowerCase()));
  }, [items, chiMaDuAn]);

  const dsNam = useMemo(
    // Năm hiện tại LUÔN có trong danh sách, kể cả chưa có dự án nào của năm đó — nếu không, ô chọn
    // đang ở năm hiện tại sẽ hiện trống trơn vì giá trị không khớp lựa chọn nào.
    () => Array.from(new Set([namHienTaiVN(), ...duocXem.map(i => namCua(i.maDuAn, i.ngayLap))].filter(Boolean))).sort().reverse(),
    [duocXem],
  );

  const hienThi = useMemo(() => {
    const q = tim.trim().toLowerCase();
    return duocXem.filter(d => {
      // Không suy ra được năm thì không lọc mất (xem ghi chú ở namCua).
      const n = namCua(d.maDuAn, d.ngayLap);
      if (nam !== 'ALL' && n && n !== nam) return false;

      // Khoảng ngày: lấy dự án có thời gian thực hiện GIAO với khoảng đã chọn, không đòi nằm
      // trọn bên trong. Dự án chạy từ tháng 6 sang tháng 10 mà lọc tháng 8 thì vẫn phải thấy —
      // đòi nằm trọn sẽ làm biến mất đúng những dự án dài ngày, là thứ cần theo dõi nhất.
      if (tuNgay || denNgay) {
        const batDau = d.ngayLap || '';
        const ketThuc = d.ngayHoanThanh || batDau;   // chưa có ngày xong thì coi như vẫn đang chạy
        if (!batDau && !ketThuc) return false;
        if (denNgay && batDau && batDau > denNgay) return false;
        if (tuNgay && ketThuc && ketThuc < tuNgay) return false;
      }

      if (tinhTrang !== 'TAT_CA') {
        const xong = daXong(d);
        if (tinhTrang === 'DA_XONG' && !xong) return false;
        if (tinhTrang === 'DANG_LAM' && xong) return false;
      }

      if (!q) return true;
      // Tìm cả trong tên hạng mục — người dùng nhớ "Kết cấu" dễ hơn nhớ mã dự án.
      return (
        (d.maDuAn || '').toLowerCase().includes(q) ||
        (d.tenDuAn || '').toLowerCase().includes(q) ||
        (d.hangMuc || []).some(h =>
          (h.ten || '').toLowerCase().includes(q) ||
          (h.nguoiThucHien || '').toLowerCase().includes(q))
      );
    });
  }, [duocXem, tim, nam, tuNgay, denNgay, tinhTrang]);

  // "Xoá lọc" đưa về ĐÚNG trạng thái mặc định (năm hiện tại), không phải về 'Tất cả' — bằng không
  // bấm xoá lọc lại ra một màn hình khác với lúc mới mở, người dùng tưởng app đổi dữ liệu.
  const macDinhNam = namHienTaiVN();
  const dangLoc = nam !== macDinhNam || !!tuNgay || !!denNgay || tinhTrang !== 'TAT_CA' || !!tim.trim();
  const xoaLoc = () => { setNam(macDinhNam); setTuNgay(''); setDenNgay(''); setTinhTrang('TAT_CA'); setTim(''); };

  // Lớp dùng chung cho thanh lọc — gom lại một chỗ để 4 ô luôn cùng kích thước, cùng kiểu.
  const nhanLoc = 'text-[10px] font-black uppercase tracking-wider text-slate-400';
  const oLoc = 'h-8 px-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-dark-elevated focus:ring-brand-accent';

  const o = 'px-3 py-2 align-middle';
  const dauCot = 'px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap';

  const dongHangMuc = (h: HangMucThietKe, ma: string) => (
    <tr key={`${ma}-${h.id}`} className="border-t border-slate-100 dark:border-slate-800/60 bg-slate-50/40 dark:bg-dark-elevated/20">
      {/* Cột STT để TRỐNG ở dòng hạng mục (chị Trâm chốt 15/09/2026: "các số này bỏ đi em").
          Đánh số lại từ 1 trong từng dự án làm rối với STT của dự án ở cùng một cột. */}
      <td className={o} />
      <td className={`${o} text-[11px] text-slate-400`}>—</td>
      <td className={`${o} pl-8 text-xs text-slate-600 dark:text-slate-300`}>
        <span className="text-slate-300 dark:text-slate-600 mr-1">└</span>
        {h.ten}
      </td>
      <td className={o}>
        <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${mauTinhTrang(h.tinhTrang)}`}>
          {h.tinhTrang || '—'}
        </span>
      </td>
      <td className={`${o} text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap`}>{dinhDangNgay(h.ngayLap)}</td>
      <td className={`${o} text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap`}>{dinhDangNgay(h.ngayHoanThanh)}</td>
      <td className={`${o} text-[11px] text-slate-600 dark:text-slate-300`}>{h.nguoiThucHien || '—'}</td>
      <td className={`${o} text-center`}><OTreHan so={h.treHan} /></td>
    </tr>
  );

  return (
    <div className="bg-white dark:bg-dark-card rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4 mb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <PencilRuler className="w-4 h-4 text-brand-accent dark:text-brand-accent-300" />
            Tiến độ thiết kế — Phòng Thiết kế
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Dữ liệu do App Thiết kế đẩy sang, ghép theo mã dự án. (Chỉ xem)
            {capNhatLuc && ` · Cập nhật ${fmtDateTimeVN(capNhatLuc)}`}
          </p>
        </div>
        {/* Bộ lọc nằm CHUNG hàng với ô tìm kiếm cho gọn (chị Trâm chốt 19/09/2026: "đưa lên đây cho
            gọn") — trước đây là một thanh riêng bên dưới, đẩy bảng xuống sâu mất gần hai hàng.
            Nhãn đặt ngay trong ô (title + nhãn ngắn) thay vì xếp chồng phía trên. */}
        <div className="flex flex-wrap items-center gap-2">
          <select value={nam} onChange={e => setNam(e.target.value)} title="Lọc theo năm — lấy từ 4 chữ số đầu của mã dự án" className={oLoc}>
            <option value="ALL">Tất cả năm</option>
            {dsNam.map(y => <option key={y} value={y}>Năm {y}</option>)}
          </select>
          <span className="inline-flex items-center gap-1">
            <span className={nhanLoc}>Từ</span>
            <input type="date" value={tuNgay} onChange={e => setTuNgay(e.target.value)} title="Từ ngày" className={oLoc} />
          </span>
          <span className="inline-flex items-center gap-1">
            <span className={nhanLoc}>Đến</span>
            <input type="date" value={denNgay} onChange={e => setDenNgay(e.target.value)} title="Đến ngày" className={oLoc} />
          </span>
          <select
            value={tinhTrang}
            onChange={e => setTinhTrang(e.target.value as typeof tinhTrang)}
            title="Lọc theo tình trạng"
            className={oLoc}
          >
            <option value="TAT_CA">Tất cả tình trạng</option>
            <option value="DANG_LAM">Đang làm</option>
            <option value="DA_XONG">Đã xong</option>
          </select>
          <span className="text-[11px] font-semibold text-slate-400 whitespace-nowrap">
            {hienThi.length}/{duocXem.length} dự án
          </span>
          {dangLoc && (
            <button
              type="button"
              onClick={xoaLoc}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-rose-500 transition-colors"
            >
              <X className="w-3 h-3" />
              Xoá lọc
            </button>
          )}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              value={tim}
              onChange={e => setTim(e.target.value)}
              placeholder="Tìm mã dự án, hạng mục..."
              className="pl-8 pr-3 py-1.5 w-52 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-dark-elevated focus:ring-brand-accent"
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

      {dangTai && duocXem.length === 0 ? (
        <div className="py-10 text-center text-xs text-slate-400">Đang tải tiến độ thiết kế...</div>
      ) : hienThi.length === 0 ? (
        <EmptyState
          icon={<PencilRuler className="w-6 h-6" />}
          title={duocXem.length === 0 ? (chiMaDuAn ? 'Chưa có tiến độ thiết kế cho gói thầu của bạn' : 'Chưa nhận được tiến độ thiết kế') : 'Không có dự án nào khớp'}
          description={
            duocXem.length === 0
              ? (chiMaDuAn
                  ? 'Bảng này chỉ hiện tiến độ thiết kế của gói thầu bạn được giao việc. Hiện chưa có gói nào có dữ liệu thiết kế.'
                  : 'App Thiết kế chưa đẩy dữ liệu sang. IT cấu hình webhook /api/webhook/tien-do-thiet-ke là bảng này tự có dữ liệu.')
              : 'Thử bỏ bớt từ khoá tìm kiếm hoặc chọn lại năm tài chính.'
          }
        />
      ) : (
        <div className="overflow-x-auto">
          {/* Ấn định bề rộng cột như bảng Danh mục dự án — cột tên dự án cần rộng hẳn, mấy cột
              ngày/tình trạng bóp lại (chị Trâm chốt 19/09/2026).
              Thứ tự cột: STT · Mã · Dự án/Hạng mục (rộng nhất) · Tình trạng · Lập dự án ·
              Hoàn thành · Người thực hiện · Trễ hạn. */}
          <table className="w-full min-w-[1000px] table-fixed border-collapse">
            <colgroup>
              <col className="w-12" />
              <col className="w-28" />
              <col className="w-[28rem]" />
              <col className="w-32" />
              <col className="w-28" />
              <col className="w-28" />
              <col className="w-36" />
              <col className="w-24" />
            </colgroup>
            <thead>
              <tr className="bg-slate-50 dark:bg-dark-elevated/50">
                <th className={`${dauCot} text-center`}>STT</th>
                <th className={`${dauCot} text-left`}>Mã dự án</th>
                <th className={`${dauCot} text-left`}>Dự án / Hạng mục</th>
                <th className={`${dauCot} text-left`}>Tình trạng dự án</th>
                <th className={`${dauCot} text-left`}>Lập dự án</th>
                <th className={`${dauCot} text-left`}>Hoàn thành</th>
                <th className={`${dauCot} text-left`}>Người thực hiện</th>
                <th className={`${dauCot} text-center`}>Trễ hạn</th>
              </tr>
            </thead>
            <tbody>
              {hienThi.map((d, idx) => {
                const mo = !!moRong[d.maDuAn];
                const hm = d.hangMuc || [];
                return (
                  <Fragment key={d.maDuAn}>
                    <tr
                      role="button"
                      tabIndex={0}
                      aria-expanded={mo}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setMoRong(s => ({ ...s, [d.maDuAn]: !mo }));
                        }
                      }}
                      className="border-t border-slate-100 dark:border-slate-800 hover:bg-brand-accent/[0.04] cursor-pointer"
                      onClick={() => setMoRong(s => ({ ...s, [d.maDuAn]: !mo }))}
                    >
                      <td className={`${o} text-center text-[11px] font-bold text-slate-500`}>{idx + 1}</td>
                      <td className={`${o} whitespace-nowrap`}>
                        <span className="inline-flex items-center gap-1 text-xs font-black text-brand-accent dark:text-brand-accent-300">
                          {hm.length > 0
                            ? (mo ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />)
                            : <span className="w-3.5" />}
                          {d.maDuAn}
                        </span>
                      </td>
                      <td className={`${o} text-xs font-bold text-slate-800 dark:text-slate-100`}>
                        {d.tenDuAn}
                        {hm.length > 0 && (
                          <span className="ml-2 text-[10px] font-semibold text-slate-400">({hm.length} hạng mục)</span>
                        )}
                      </td>
                      <td className={o}>
                        <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${mauTinhTrang(d.tinhTrang)}`}>
                          {d.tinhTrang || '—'}
                        </span>
                      </td>
                      <td className={`${o} text-[11px] text-slate-600 dark:text-slate-300 whitespace-nowrap`}>{dinhDangNgay(d.ngayLap)}</td>
                      <td className={`${o} text-[11px] text-slate-600 dark:text-slate-300 whitespace-nowrap`}>{dinhDangNgay(d.ngayHoanThanh)}</td>
                      {/* Người thực hiện & Trễ hạn để TRỐNG ở dòng dự án (chị Trâm chốt 15/09/2026):
                          "ở cv cha thì ko có ng thực hiện và tình trạng gói thầu, chỉ có ở cv con
                           bên trong mới có". Việc giao cho ai và trễ bao nhiêu là chuyện của từng
                          hạng mục — gộp lên dòng cha thành một con số chung là đọc sai trách nhiệm. */}
                      <td className={o} />
                      <td className={o} />
                    </tr>
                    {mo && hm.map(h => dongHangMuc(h, d.maDuAn))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
