'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, RefreshCw, FolderKanban, X, Plus } from 'lucide-react';
import { EmptyState } from './ui/EmptyState';
import { namHienTaiVN, fmtDateTimeVN } from '../utils/dateVN';
import { dinhDangSo } from '../lib/utils';
import type { DuAnTong } from '../lib/duAnTongTypes';

/**
 * BẢNG DANH MỤC DỰ ÁN TỪ APP THÔNG TIN DỰ ÁN — tab "Liên kết phòng ban" (chị Trâm chốt 19/09/2026)
 *
 * "Ở mục liên kết phòng ban, trên Tiến độ thiết kế — Phòng Thiết kế, làm cho chị 1 bảng đổ dữ liệu
 *  dự án từ App Thông tin dự án về nữa nha em. Tất cả các thông tin gói thầu được khởi tạo ở app
 *  đó đều về app mình nhé em, tạo trường sẵn cho IT liên kết webhook qua."
 *
 * Dữ liệu vào từ /api/du-an-tong — đọc thứ App Thông tin dự án ĐẨY sang qua
 * /api/webhook/du-an-tong. Bảng CHỈ XEM: danh mục do app kia làm chủ, sửa bên này là hai nơi lệch.
 *
 * Bảng đặt TRÊN bảng tiến độ thiết kế, đúng thứ tự liên kết chị Trâm chốt: có mã dự án trước, rồi
 * mới tra tiến độ thiết kế của mã đó.
 */

type Props = {
  /** Dữ liệu dựng sẵn cho Bản thử. Có giá trị thì KHÔNG gọi API. */
  duLieuBanThu?: DuAnTong[];
  /**
   * Chỉ cho xem những mã dự án này. `null`/bỏ trống = xem hết.
   * Dùng cho Chuyên viên (Level 3) — cùng phạm vi với bảng tiến độ thiết kế.
   */
  chiMaDuAn?: string[] | null;
  /**
   * Bấm cây bút trên một dòng (chị Trâm chốt 19/09/2026: "vậy cho chị thêm cây bút đi, và đưa
   * tính năng sửa thông tin gói thầu về đây"). Không truyền = không có quyền sửa, cột bút ẩn luôn.
   * `daCoHoSo` cho biết app đã có hồ sơ dự án cho mã đó chưa, để đổi câu nhắc cho đúng việc.
   */
  onSua?: (maDuAn: string) => void;
  /** Mã dự án mà app đấu thầu ĐÃ có hồ sơ — dùng để hiện nhãn và đổi tooltip nút +. */
  maDaCoHoSo?: string[];
  /**
   * LỐI DỰ PHÒNG: tạo hồ sơ dự án bằng tay (chị Trâm chốt 19/09/2026: "vậy e cho c nút tạo thủ
   * công, phòng trường hợp app thông tin dự án chưa làm xong").
   * Không truyền = ẩn nút. CỐ Ý đặt trong bảng này chứ không đưa lên thanh công cụ: quy trình
   * chuẩn vẫn là đăng ký bên App Thông tin dự án, nút này chỉ để không bị kẹt lúc app kia chưa nối.
   */
  onTaoThuCong?: () => void;
};

const dinhDangNgay = (s?: string): string => {
  if (!s) return '—';
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
};

/**
 * NĂM CỦA DỰ ÁN — lấy từ 4 CHỮ SỐ ĐẦU CỦA MÃ DỰ ÁN (chị Trâm chốt 19/09/2026)
 *
 * "Liên kết short Năm với 4 chữ số đầu của mã dự án nhé em."
 * Mã bên App Thông tin dự án có dạng 2026.81 — bốn số đầu chính là năm, và đó cũng là thứ người
 * dùng nhìn vào để nhận ra dự án của năm nào. Lọc theo ngày khởi tạo thì lệch: dự án mã 2026.xx
 * nhưng khai ngày khởi tạo cuối 2025 sẽ rơi vào năm 2025, đọc lên thấy vô lý.
 *
 * DỰ PHÒNG: mã nào bốn số đầu không ra một năm hợp lệ (mã cũ kiểu 250118-HPCS → "2501") thì quay
 * về lấy năm từ ngày — để hồ sơ mã cũ không biến mất khỏi mọi bộ lọc.
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
  if (s.includes('đóng') || s.includes('hoàn thành') || s.includes('xong')) return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300';
  if (s.includes('dừng') || s.includes('huỷ') || s.includes('hủy')) return 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300';
  if (s.includes('triển khai') || s.includes('đang')) return 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300';
  return 'bg-slate-100 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300';
};

export default function DanhMucDuAnPanel({ duLieuBanThu, chiMaDuAn, onSua, maDaCoHoSo, onTaoThuCong }: Props) {
  const [items, setItems] = useState<DuAnTong[]>(duLieuBanThu || []);
  const [dangTai, setDangTai] = useState(!duLieuBanThu);
  const [thongBao, setThongBao] = useState('');
  const [capNhatLuc, setCapNhatLuc] = useState('');
  const [tim, setTim] = useState('');
  // MẶC ĐỊNH lọc theo NĂM HIỆN TẠI — cùng quy ước với Kanban, Gantt, Dashboard và bảng thiết kế.
  const [nam, setNam] = useState<string>(() => namHienTaiVN());
  const [lanTai, setLanTai] = useState(0);

  useEffect(() => {
    // Bản thử: dùng dữ liệu dựng sẵn, TUYỆT ĐỐI không gọi API.
    if (duLieuBanThu) { setItems(duLieuBanThu); setDangTai(false); return; }
    let huy = false;
    setDangTai(true);
    (async () => {
      try {
        const res = await fetch('/api/du-an-tong', { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (huy) return;
        setItems(Array.isArray(data?.items) ? data.items : []);
        setCapNhatLuc(data?.capNhatLuc || '');
        setThongBao(data?.thongBao || (res.ok ? '' : 'Không đọc được danh mục dự án.'));
      } catch {
        if (!huy) setThongBao('Không gọi được App Thông tin dự án.');
      } finally {
        if (!huy) setDangTai(false);
      }
    })();
    return () => { huy = true; };
  }, [duLieuBanThu, lanTai]);

  /** Thu hẹp theo phạm vi được xem TRƯỚC mọi bộ lọc khác — xem ghi chú ở TienDoThietKePanel. */
  const duocXem = useMemo(() => {
    if (!chiMaDuAn) return items;
    const cho = new Set(chiMaDuAn.map(m => m.trim().toLowerCase()).filter(Boolean));
    return items.filter(d => cho.has((d.maDuAn || '').trim().toLowerCase()));
  }, [items, chiMaDuAn]);

  const dsNam = useMemo(
    // Năm hiện tại LUÔN có trong danh sách, kể cả chưa có dự án nào của năm đó.
    () => Array.from(new Set([namHienTaiVN(), ...duocXem.map(i => namCua(i.maDuAn, i.ngayKhoiTao))].filter(Boolean))).sort().reverse(),
    [duocXem],
  );

  const hienThi = useMemo(() => {
    const q = tim.trim().toLowerCase();
    return duocXem.filter(d => {
      // Không suy ra được năm (mã lạ và cũng không có ngày) thì KHÔNG lọc mất — bên kia bỏ trống
      // trường đó là chuyện thường, lọc mất thì người dùng tưởng app nuốt dữ liệu.
      const n = namCua(d.maDuAn, d.ngayKhoiTao);
      if (nam !== 'ALL' && n && n !== nam) return false;
      if (!q) return true;
      return [d.maDuAn, d.tenDuAn, d.chuDauTu, d.diaChi, d.khuCongNghiep, d.tinhThanh, d.loaiCongTrinh]
        .some(v => (v || '').toLowerCase().includes(q));
    });
  }, [duocXem, tim, nam]);

  const boMaDaCo = useMemo(
    () => new Set((maDaCoHoSo || []).map(m => m.trim().toLowerCase()).filter(Boolean)),
    [maDaCoHoSo],
  );

  const macDinhNam = namHienTaiVN();
  const dangLoc = nam !== macDinhNam || !!tim.trim();
  const xoaLoc = () => { setNam(macDinhNam); setTim(''); };

  const o = 'px-2 py-2 align-middle text-[11px] text-slate-600 dark:text-slate-300';
  // KHÔNG dùng whitespace-nowrap cho tiêu đề: chữ dài ("Hồ sơ phát thầu") sẽ ép cột rộng hơn phần
  // trăm đã khai, kéo cả bảng tràn khung dù colgroup nói khác.
  const dauCot = 'px-2 py-2 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 leading-tight';
  const oLoc = 'h-8 px-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-dark-elevated focus:ring-brand-accent';

  return (
    <div className="bg-white dark:bg-dark-card rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4 mb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FolderKanban className="w-4 h-4 text-brand-primary dark:text-brand-primary-300" />
            Danh mục dự án — App Thông tin dự án
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Dự án đăng ký bên App Thông tin dự án rồi đổ về đây. Bấm <b>+</b> để cộng thông tin thầu.
            {capNhatLuc && ` · Cập nhật ${fmtDateTimeVN(capNhatLuc)}`}
          </p>
        </div>
        {/* Bộ lọc nằm CHUNG hàng với ô tìm kiếm cho gọn (chị Trâm chốt 19/09/2026: "đưa mục này
            qua đây cho gọn") — trước đây tách thành một thanh riêng bên dưới, tốn nguyên một hàng
            mà chỉ có đúng một ô chọn năm. */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={nam}
            onChange={e => setNam(e.target.value)}
            title="Lọc theo năm — lấy từ 4 chữ số đầu của mã dự án"
            className={oLoc}
          >
            <option value="ALL">Tất cả năm</option>
            {dsNam.map(y => <option key={y} value={y}>Năm {y}</option>)}
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
              placeholder="Tìm mã, tên dự án, CĐT..."
              className="pl-8 pr-3 py-1.5 w-56 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-dark-elevated focus:ring-brand-accent"
            />
          </div>
          {onTaoThuCong && (
            <button
              type="button"
              onClick={onTaoThuCong}
              title="Dùng khi App Thông tin dự án chưa nối — quy trình chuẩn là đăng ký dự án bên app đó trước"
              className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-[11px] font-bold text-slate-500 hover:text-brand-accent hover:border-brand-accent transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Tạo thủ công
            </button>
          )}
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
        <div className="py-10 text-center text-xs text-slate-400">Đang tải danh mục dự án...</div>
      ) : hienThi.length === 0 ? (
        <EmptyState
          icon={<FolderKanban className="w-6 h-6" />}
          title={duocXem.length === 0
            ? (chiMaDuAn ? 'Chưa có dự án nào của bạn' : 'Chưa nhận được danh mục dự án')
            : 'Không có dự án nào khớp'}
          action={onTaoThuCong && duocXem.length === 0 && !chiMaDuAn ? (
            <button
              type="button"
              onClick={onTaoThuCong}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-black bg-brand-accent hover:bg-brand-accent-700 text-white transition-colors"
            >
              <Plus className="w-4 h-4" />
              Tạo hồ sơ dự án thủ công
            </button>
          ) : undefined}
          description={duocXem.length === 0
            ? (chiMaDuAn
                ? 'Bảng này chỉ hiện dự án của gói thầu bạn được giao việc.'
                : 'Dự án phải được đăng ký bên App Thông tin dự án trước, rồi mới đổ về đây để Phòng mở hồ sơ thầu. Chưa thấy dự án nào — nhờ IT cấu hình webhook /api/webhook/du-an-tong.')
            : 'Thử bỏ bớt từ khoá tìm kiếm hoặc chọn lại năm.'}
        />
      ) : (
        <div className="overflow-x-auto">
          {/* ===== BẢNG PHẢI VỪA KHUNG, KHÔNG BẮT CUỘN NGANG (chị Trâm chốt 19/09/2026) =====
              "Fix cột lại tí cho gọn chứ trượt sang ngang để xem thông tin bất tiện quá."
              14 cột thì kiểu gì cũng tràn khung. Nên GOM những trường vốn đi liền nhau về chung
              một cột, xếp hai dòng (dòng chính + dòng phụ chữ nhỏ) — vẫn đủ thông tin mà số cột
              giảm từ 14 xuống 10:
                · Chủ đầu tư   ← kèm Quốc tịch
                · Địa điểm     ← Địa chỉ + KCN + Tỉnh/TP
                · Phân loại    ← Loại công trình + Hình thức xây dựng
                · Giai đoạn    ← Giai đoạn + Tình trạng
                · Khởi tạo     ← Ngày + Người tạo
              Bề rộng khai bằng PHẦN TRĂM (không phải px) nên bảng co theo khung màn hình, máy nào
              cũng vừa, không còn thanh trượt ngang.
              ⚠ KHÔNG đặt chú thích bên trong <colgroup>: JSX comment sinh text node, React báo
              hydration error. */}
          <table className="w-full table-fixed border-collapse">
            <colgroup>
              <col style={{ width: '4%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '17%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '6%' }} />
              <col style={{ width: onSua ? '10%' : '16%' }} />
              {onSua && <col style={{ width: '6%' }} />}
            </colgroup>
            <thead>
              <tr className="bg-slate-50 dark:bg-dark-elevated/50">
                <th className={`${dauCot} text-center`}>STT</th>
                <th className={`${dauCot} text-left`}>Mã dự án</th>
                <th className={`${dauCot} text-left`}>Tên dự án</th>
                <th className={`${dauCot} text-left`}>Chủ đầu tư</th>
                <th className={`${dauCot} text-left`}>Địa điểm</th>
                <th className={`${dauCot} text-left`}>Phân loại</th>
                <th className={`${dauCot} text-left`}>Hồ sơ phát thầu</th>
                <th className={`${dauCot} text-right`}>DT (m²)</th>
                <th className={`${dauCot} text-left`}>Giai đoạn</th>
                {onSua && <th className={`${dauCot} text-center`} aria-label="Thêm thông tin thầu" />}
              </tr>
            </thead>
            <tbody>
              {hienThi.map((d, idx) => {
                const diaDiem = [d.khuCongNghiep, d.tinhThanh].filter(Boolean).join(' · ');
                const phanLoai = [d.loaiCongTrinh, d.hinhThucXayDung].filter(Boolean);
                return (
                  <tr
                    key={d.maDuAn}
                    className="border-t border-slate-100 dark:border-slate-800 hover:bg-brand-primary/[0.04]"
                    title={`Khởi tạo ${dinhDangNgay(d.ngayKhoiTao)}${d.nguoiTao ? ` · ${d.nguoiTao}` : ''}`}
                  >
                    <td className={`${o} text-center font-bold text-slate-500`}>{idx + 1}</td>
                    <td className={`${o} font-black text-brand-primary dark:text-brand-primary-300`}>
                      {d.maDuAn}
                      {/* Ngày & người khởi tạo xuống dòng phụ — thông tin tra cứu, không cần cột riêng */}
                      <span className="block text-[10px] font-medium text-slate-400 mt-0.5">
                        {dinhDangNgay(d.ngayKhoiTao)}
                      </span>
                      {onSua && !boMaDaCo.has((d.maDuAn || '').trim().toLowerCase()) && (
                        <span className="block text-[9px] font-bold text-brand-warning mt-0.5" title="Phòng Đấu thầu chưa mở hồ sơ cho dự án này">
                          Chưa có hồ sơ
                        </span>
                      )}
                    </td>
                    <td className={`${o} font-bold text-slate-800 dark:text-slate-100`}>{d.tenDuAn || '—'}</td>
                    <td className={o}>
                      {d.chuDauTu || '—'}
                      {d.quocTich && <span className="block text-[10px] text-slate-400 mt-0.5">{d.quocTich}</span>}
                    </td>
                    <td className={o}>
                      {!d.diaChi && !diaDiem ? '—' : (
                        <>
                          {d.diaChi && <span className="block">{d.diaChi}</span>}
                          {diaDiem && <span className="block text-[10px] text-slate-400 mt-0.5">{diaDiem}</span>}
                        </>
                      )}
                    </td>
                    <td className={o}>
                      {phanLoai.length === 0 ? '—' : (
                        <>
                          <span className="block">{phanLoai[0]}</span>
                          {phanLoai[1] && <span className="block text-[10px] text-slate-400 mt-0.5">{phanLoai[1]}</span>}
                        </>
                      )}
                    </td>
                    <td className={o}>{d.hoSoPhatThau || '—'}</td>
                    <td className={`${o} text-right font-semibold`}>
                      {d.dienTichDat ? dinhDangSo(d.dienTichDat) : '—'}
                    </td>
                    <td className={o}>
                      {d.giaiDoanDuAn && <span className="block mb-1">{d.giaiDoanDuAn}</span>}
                      <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${mauTinhTrang(d.tinhTrangDuAn)}`}>
                        {d.tinhTrangDuAn || '—'}
                      </span>
                    </td>
                    {onSua && (() => {
                      // ===== CHỈ DẤU CỘNG, KHÔNG CÂY BÚT (chị Trâm chốt 19/09/2026) =====
                      // "Em không cần ghi chữ thông tin thêm, chỉ cần thêm dấu cộng (có nghĩa là
                      //  cộng thông tin đó em) là được, không thêm cây bút luôn."
                      // Một biểu tượng duy nhất cho mọi dòng: bấm vào là CỘNG THÊM thông tin thầu
                      // vào dự án — dù dự án đã có hồ sơ hay chưa. Cột cũng không cần tiêu đề.
                      const daCo = boMaDaCo.has((d.maDuAn || '').trim().toLowerCase());
                      return (
                        <td className={`${o} text-center`}>
                          <button
                            type="button"
                            onClick={() => onSua(d.maDuAn)}
                            title={daCo
                              ? 'Thêm thông tin dự án của Đấu thầu'
                              : 'Thêm thông tin dự án của Đấu thầu — app sẽ mở hồ sơ từ danh mục này'}
                            className="p-1.5 inline-flex items-center justify-center rounded-lg border border-brand-success/40 text-brand-success hover:bg-brand-success/10 transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </td>
                      );
                    })()}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
