import { useMemo } from 'react';
import { Project, Staff } from '../types';
import { X, ExternalLink, Building2, CalendarDays, Clock, Users, ListTodo, Send, Pencil, RotateCcw } from 'lucide-react';
import { maHoSo } from '../lib/utils';
import { khauDangTre, nhanKhauTre, chiTietTheoVong } from '../App';
import { fmtDateVN, tongNgayDoiHan, soNgayDoiCuaLog } from '../utils/dateVN';
import { getTaskProgress, tasksOfRound } from '../utils/taskTree';
import { tongSoLanGuiCDT } from '../utils/guiCDT';
import { KANBAN_STEPS, deriveKanbanStep, BUOC_XONG_PHAN_PHONG, dangTreHan } from './KanbanBoard';
import { useModalA11y } from '../utils/useModalA11y';

/**
 * KHUNG XEM NHANH HỒ SƠ — bật ngay tại chỗ đang đứng (yêu cầu của Tổng công ty, chị Trâm chuyển
 * ngày 12/09/2026): "Ở Dashboard + Kanban + Gantt, bấm vào trong sẽ hiện popup khung chính của dự
 * án lên trang đó luôn, không nhảy về trang báo cáo tiến độ để hiện thông tin tóm tắt nữa."
 *
 * VÌ SAO CẦN: trước đây bấm một thẻ Kanban là app đổi tab sang Báo Cáo Tiến Độ, đổi bộ lọc trạng
 * thái, rồi cuộn tới đúng hàng. Xem xong muốn quay lại đúng chỗ cũ trên Kanban/Gantt thì phải tự
 * dò lại từ đầu — rất mất mạch khi đang rà một lượt nhiều hồ sơ.
 *
 * SỬA & LƯU NGAY TẠI ĐÂY (chị Trâm chốt 12/09/2026: "cái popup này không phải chỉ để xem mà cho
 * sửa và lưu luôn em"). Bấm "Sửa hồ sơ" là khung đổi sang chính form hồ sơ đầy đủ (ProjectForm),
 * ngay trong popup, không rời trang đang đứng.
 *
 * CỐ Ý DÙNG LẠI ProjectForm chứ không dựng bộ ô nhập riêng ở đây: mọi ràng buộc nghiệp vụ đã nằm
 * trong form đó — tỉ trọng đủ 100% mỗi vòng, bắt khai phiếu khi hạn bị đẩy xa, cảnh báo trễ hẹn
 * CĐT, khóa các trường thuộc Dự án, đồng bộ dự án cha xuống công việc con. Viết lại một bản rút
 * gọn ở đây thì sớm muộn hai bên cũng lệch luật và sinh đúng loại bug "mỗi màn hình một kiểu".
 *
 * PHÂN QUYỀN: khung này KHÔNG tự xét quyền — App quyết định có truyền `onEdit` hay không, dùng
 * đúng điều kiện của nút sửa ở màn Báo Cáo Tiến Độ, nên không có đường vòng cấp thêm quyền.
 */

interface ProjectQuickViewProps {
  project: Project;
  staff: Staff[];
  /** Tên dự án cha (tra theo duAnChaId) — hồ sơ công việc nào cũng thuộc một dự án. */
  parentName?: string;
  /** Hạn Bộ phận / Phòng / thầu — App truyền vào để dùng ĐÚNG công thức chung, không tính lại. */
  hanBoPhan: string;
  hanPhong: string;
  onClose: () => void;
  /** Mở hồ sơ đầy đủ ở màn Báo Cáo Tiến Độ (đường cũ, giữ nguyên cho ai cần xem cả danh sách). */
  onOpenFull: () => void;
  /**
   * Chuyển khung này sang CHẾ ĐỘ SỬA ngay tại chỗ (chị Trâm chốt 12/09/2026: "cái popup này không
   * phải chỉ để xem mà cho sửa và lưu luôn"). Bỏ trống = cấp đang đăng nhập không có quyền sửa.
   */
  onEdit?: () => void;
}

const nhanTrangThai = (p: Project) => {
  if (dangTreHan(p)) return { chu: 'Trễ tiến độ', mau: 'bg-brand-danger/15 text-brand-danger' };
  if (p.trangThai === 'HOAN_THANH_TRE_HAN') return { chu: 'Hoàn thành trễ hạn', mau: 'bg-brand-warning/15 text-brand-warning' };
  if (p.trangThai === 'HOAN_THANH_DUNG_HAN') return { chu: 'Hoàn thành đúng hạn', mau: 'bg-brand-success/15 text-brand-success' };
  return { chu: 'Đang thực hiện', mau: 'bg-brand-accent/15 text-brand-accent dark:text-brand-accent-300' };
};

export default function ProjectQuickView({
  project: p, staff, parentName, hanBoPhan, hanPhong, onClose, onOpenFull, onEdit,
}: ProjectQuickViewProps) {
  const ref = useModalA11y(onClose, true);

  const buoc = deriveKanbanStep(p);
  const tenBuoc = KANBAN_STEPS.find(s => s.id === buoc)?.title || `Bước ${buoc}`;
  const vong = Math.max(1, p.vongHienTai || 1);
  const tt = nhanTrangThai(p);
  const tenNs = (id?: string) => staff.find(s => s.id === id)?.hoTen || '—';
  const soNgayDoi = tongNgayDoiHan(p.delayLogs);
  // Khâu đang gây trễ NGAY LÚC NÀY (chị Trâm 15/09/2026) — suy từ tiến độ so với hạn Bộ phận/Phòng.
  const khauTreHienTai = khauDangTre(p);
  // Đếm các lần dời trước đây theo khâu, để thấy khâu nào hay chậm lặp lại.
  const demKhauTre = useMemo(() => {
    const d = { BO_PHAN: 0, PHONG: 0 };
    (p.delayLogs || []).forEach(l => {
      if (l.khauTre === 'BO_PHAN') d.BO_PHAN++;
      else if (l.khauTre === 'PHONG') d.PHONG++;
    });
    return d;
  }, [p.delayLogs]);
  const soLanGui = tongSoLanGuiCDT(p);
  // ===== LỊCH SỬ CÁC VÒNG (chị Trâm 15/09/2026: "muốn coi lịch sử các vòng thì sao em") =====
  // Dùng CHUNG hàm chiTietTheoVong với file xuất Excel — không dựng bản tính thứ hai ở đây, bằng
  // không màn hình và file Excel sớm muộn ra hai con số khác nhau.
  const cacVong = useMemo(() => chiTietTheoVong(p), [p]);
  // Phiếu dời hạn & lần CĐT trả về, gom theo vòng — để mỗi dòng vòng kể đủ chuyện đã xảy ra.
  const phieuTheoVong = useMemo(() => {
    const m: Record<number, { soPhieu: number; soNgay: number; khau: string[] }> = {};
    (p.delayLogs || []).forEach(l => {
      const v = Math.max(1, l.vong || 1);
      if (!m[v]) m[v] = { soPhieu: 0, soNgay: 0, khau: [] };
      m[v].soPhieu++;
      m[v].soNgay += soNgayDoiCuaLog(l);
      if (l.khauTre === 'BO_PHAN' || l.khauTre === 'PHONG') m[v].khau.push(l.khauTre);
    });
    return m;
  }, [p.delayLogs]);

  // Việc con của VÒNG đang chạy — đúng bộ việc mà tiến độ Bộ phận đang tính trên đó.
  const viecVong = useMemo(() => tasksOfRound(p.tasks, vong), [p.tasks, vong]);

  const nguoiThucHien = useMemo(() => {
    const ids = new Set<string>([p.thucHienId, ...(p.thucHienIds || [])].filter(Boolean) as string[]);
    return Array.from(ids).map(tenNs).filter(x => x !== '—');
  }, [p.thucHienId, p.thucHienIds, staff]);

  const Dong = ({ nhan, giaTri, manh }: { nhan: string; giaTri: React.ReactNode; manh?: boolean }) => (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 shrink-0">{nhan}</span>
      <span className={`text-[11.5px] text-right ${manh ? 'font-black text-slate-800 dark:text-slate-100' : 'font-medium text-slate-600 dark:text-slate-300'}`}>
        {giaTri}
      </span>
    </div>
  );

  const Thanh = ({ nhan, v }: { nhan: string; v: number }) => (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">{nhan}</span>
        <span className="text-xs font-black tabular-nums text-slate-700 dark:text-slate-200">{v}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
        <div className={`h-full rounded-full ${v >= 100 ? 'bg-brand-success' : 'bg-brand-accent'}`} style={{ width: `${Math.min(100, Math.max(0, v))}%` }} />
      </div>
    </div>
  );

  const Khoi = ({ icon, tieuDe, children }: { icon: React.ReactNode; tieuDe: string; children: React.ReactNode }) => (
    <section className="rounded-xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/60 dark:bg-dark-bg/40 p-3">
      <h4 className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
        {icon}{tieuDe}
      </h4>
      {children}
    </section>
  );

  return (
    <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center p-0 md:p-4 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="quickview-title"
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        className="bg-white dark:bg-dark-card w-full max-w-2xl rounded-t-2xl md:rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[88vh] animate-in slide-in-from-bottom md:zoom-in-95 duration-150"
      >
        {/* ĐẦU KHUNG — mã hồ sơ, tên gói thầu, bước đang đứng */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-brand-accent/[0.07] dark:bg-brand-accent/10">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-[11px] font-black px-1.5 py-0.5 rounded bg-white dark:bg-dark-elevated text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  {maHoSo(p)}
                </span>
                <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-brand-accent/15 text-brand-accent dark:text-brand-accent-300">
                  {p.hangMuc}
                </span>
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${tt.mau}`}>{tt.chu}</span>
                {vong > 1 && (
                  <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-brand-warning/15 text-brand-warning">🔁 Vòng {vong}</span>
                )}
              </div>
              <h3 id="quickview-title" className="text-sm font-black text-slate-900 dark:text-white mt-1.5 leading-snug">
                {p.tenDuAn}
              </h3>
              {parentName && parentName !== p.tenDuAn && (
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">📁 {parentName}</p>
              )}
            </div>
            <button type="button" onClick={onClose} aria-label="Đóng"
              className="p-1.5 rounded-lg text-slate-400 hover:bg-white/70 dark:hover:bg-dark-elevated shrink-0 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Bước Kanban đang đứng — đọc một dòng là biết hồ sơ tới đâu */}
          <div className="mt-3 flex items-center gap-2 text-[11px]">
            <span className="font-black text-slate-500 dark:text-slate-400 shrink-0">Bước {buoc}/7</span>
            <div className="flex-1 flex gap-0.5">
              {KANBAN_STEPS.map(s => (
                <span key={s.id}
                  title={`Bước ${s.id} — ${s.title}`}
                  className={`h-1.5 flex-1 rounded-full ${
                    s.id < buoc ? 'bg-brand-accent/50' : s.id === buoc ? 'bg-brand-accent' : 'bg-slate-200 dark:bg-slate-800'
                  }`} />
              ))}
            </div>
            <span className="font-bold text-slate-700 dark:text-slate-200 shrink-0 max-w-[46%] truncate" title={tenBuoc}>{tenBuoc}</span>
          </div>
          {buoc >= BUOC_XONG_PHAN_PHONG && (
            <p className="mt-2 text-[10.5px] font-bold text-brand-success">
              ✓ Phòng đã xong phần mình từ Bước {BUOC_XONG_PHAN_PHONG} — phần còn lại là tiến độ chiến lược.
            </p>
          )}
        </div>

        <div className="p-4 space-y-3 overflow-y-auto flex-1">
          {/* TIẾN ĐỘ */}
          <div className="grid grid-cols-2 gap-3">
            <Thanh nhan="Bộ phận" v={p.tienDoBoPhan || 0} />
            <Thanh nhan="Phòng duyệt" v={p.tienDoPhong || 0} />
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            {/* MỐC THỜI GIAN */}
            <Khoi icon={<CalendarDays className="w-3 h-3" />} tieuDe="Mốc thời gian">
              <Dong nhan="Bắt đầu" giaTri={fmtDateVN(p.ngayBatDau)} />
              <Dong nhan="Hạn Bộ phận" giaTri={fmtDateVN(hanBoPhan)} />
              <Dong nhan="Hạn Phòng" giaTri={fmtDateVN(hanPhong)} manh />
              {/* BỎ DÒNG "HẠN THẦU" KHỎI MỐC THỜI GIAN (chị Trâm chốt 19/09/2026).
                  Hạn thầu = hạn Phòng cộng số ngày Ban lãnh đạo duyệt — là mốc nội bộ dùng để chấm
                  đúng hạn / trễ hạn, không phải mốc ai đó phải làm gì vào ngày đó. Đặt cạnh "Hẹn CĐT"
                  lại thành hai ngày na ná nhau, người xem hay lẫn ngày nào mới là ngày phải nộp. */}
              {p.hanHenCDT && <Dong nhan="🤝 Hẹn CĐT" giaTri={fmtDateVN(p.hanHenCDT)} />}
              {p.ngayHoanThanhThucTe && <Dong nhan="Hoàn thành thực tế" giaTri={fmtDateVN(p.ngayHoanThanhThucTe)} />}
              {soNgayDoi > 0 && (
                <Dong nhan="Đã dời hạn" giaTri={<span className="text-brand-warning font-black">+{soNgayDoi} ngày · {p.delayLogs?.length} lần</span>} />
              )}
              {/* ĐANG TRỄ Ở KHÂU NÀO (chị Trâm 15/09/2026) — app tự chấm theo tiến độ so với hạn
                  Bộ phận / hạn Phòng, nhìn khung xem nhanh là biết hồ sơ đang nằm chờ ở đâu,
                  khỏi mở form ra đọc từng dòng lý do. */}
              {khauTreHienTai !== 'CHUA_TRE' && (
                <Dong nhan="Đang trễ ở" giaTri={
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-black ${nhanKhauTre(khauTreHienTai).mau}`}>
                    {nhanKhauTre(khauTreHienTai).chu}
                  </span>
                } />
              )}
              {/* Thống kê nhanh các lần đã dời trước đây thuộc khâu nào — để nhìn ra thói quen chậm
                  lặp lại ở một khâu, thứ mà đọc rời từng phiếu không thấy được. */}
              {(demKhauTre.BO_PHAN > 0 || demKhauTre.PHONG > 0) && (
                <Dong nhan="Lịch sử trễ" giaTri={
                  <span className="font-medium">
                    {demKhauTre.BO_PHAN > 0 && <span className="text-brand-warning font-black">Bộ phận {demKhauTre.BO_PHAN} lần</span>}
                    {demKhauTre.BO_PHAN > 0 && demKhauTre.PHONG > 0 && <span className="text-slate-400"> · </span>}
                    {demKhauTre.PHONG > 0 && <span className="text-brand-danger font-black">Phòng {demKhauTre.PHONG} lần</span>}
                  </span>
                } />
              )}
            </Khoi>

            {/* NHÂN SỰ */}
            <Khoi icon={<Users className="w-3 h-3" />} tieuDe="Nhân sự phụ trách">
              <Dong nhan="Quản lý chính" giaTri={tenNs(p.quanLyId)} manh />
              {!!p.quanLyIdsPhu?.length && (
                <Dong nhan="Quản lý phụ" giaTri={p.quanLyIdsPhu.map(tenNs).join(', ')} />
              )}
              <Dong nhan="Thực hiện" giaTri={nguoiThucHien.length ? nguoiThucHien.join(', ') : '—'} />
              {soLanGui > 0 && <Dong nhan="Đã gửi CĐT" giaTri={<span className="font-black">{soLanGui} lần</span>} />}
            </Khoi>
          </div>

          {/* THÔNG TIN DỰ ÁN */}
          <Khoi icon={<Building2 className="w-3 h-3" />} tieuDe="Thông tin dự án">
            <Dong nhan="Chủ đầu tư" giaTri={p.chuDauTu || '—'} manh />
            <Dong nhan="Địa chỉ" giaTri={p.diaChi || '—'} />
            {p.tinhTrangDuAn && <Dong nhan="Tình trạng" giaTri={p.tinhTrangDuAn} />}
            {p.hinhThucDauThau && <Dong nhan="Hình thức" giaTri={p.hinhThucDauThau} />}
            {p.moTa && (
              <p className="mt-1.5 pt-1.5 border-t border-slate-200/70 dark:border-slate-800 text-[11px] font-medium text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                {p.moTa}
              </p>
            )}
          </Khoi>

          {/* VIỆC CON CỦA VÒNG ĐANG CHẠY */}
          <Khoi icon={<ListTodo className="w-3 h-3" />} tieuDe={`Công việc con — vòng ${vong} (${viecVong.length})`}>
            {viecVong.length === 0 ? (
              <p className="text-[11px] font-medium text-slate-400 italic">Chưa phân rã công việc con cho vòng này.</p>
            ) : (
              <div className="space-y-1.5">
                {viecVong.map(t => {
                  const td = getTaskProgress(t);
                  return (
                    <div key={t.id} className="flex items-center gap-2">
                      <span className={`text-[11px] font-medium flex-1 min-w-0 truncate ${t.isCompleted ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-200'}`}
                        title={`${t.name} — ${tenNs(t.assignedTo)}`}>
                        {t.name}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 shrink-0 hidden sm:inline">{tenNs(t.assignedTo)}</span>
                      <span className="text-[10px] font-mono text-slate-400 shrink-0 w-9 text-right">{t.weight}%</span>
                      <div className="h-1.5 w-14 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden shrink-0">
                        <div className={`h-full rounded-full ${td >= 100 ? 'bg-brand-success' : 'bg-brand-accent'}`} style={{ width: `${td}%` }} />
                      </div>
                      <span className="text-[10px] font-black tabular-nums text-slate-600 dark:text-slate-300 shrink-0 w-8 text-right">{td}%</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Khoi>

          {/* KẾT QUẢ CẤP PHÒNG + NGUYÊN NHÂN TRỄ */}
          {(p.ketQuaPhong || p.nguyenNhanTreHan) && (
            <Khoi icon={<Clock className="w-3 h-3" />} tieuDe="Ghi nhận">
              {p.ketQuaPhong && (
                <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                  <b className="text-slate-700 dark:text-slate-200">Kết quả cấp Phòng:</b> {p.ketQuaPhong}
                </p>
              )}
              {p.nguyenNhanTreHan && (
                <p className="text-[11px] font-medium text-brand-danger leading-relaxed mt-1 whitespace-pre-line">
                  <b>Nguyên nhân trễ:</b> {p.nguyenNhanTreHan}
                </p>
              )}
            </Khoi>
          )}

          {/* ===== LỊCH SỬ CÁC VÒNG =====
              Chỉ hiện khi hồ sơ đã qua từ 2 vòng trở lên — hồ sơ một vòng thì mọi thông tin đã nằm
              ở các khối trên, thêm bảng một dòng chỉ làm rối. */}
          {cacVong.length > 1 && (
            <Khoi icon={<RotateCcw className="w-3 h-3" />} tieuDe={`Lịch sử các vòng (${cacVong.length} vòng)`}>
              <div className="overflow-x-auto -mx-1 px-1">
                <table className="w-full text-[11px] border-collapse min-w-[430px]">
                  <thead>
                    <tr className="text-[9.5px] font-black uppercase tracking-wide text-slate-400 dark:text-slate-500 border-b border-slate-200/70 dark:border-slate-800">
                      <th className="py-1 pr-2 text-left">Vòng</th>
                      <th className="py-1 px-2 text-left">Khoảng thời gian</th>
                      <th className="py-1 px-2 text-center">Số ngày</th>
                      <th className="py-1 px-2 text-center">Tiến độ</th>
                      <th className="py-1 px-2 text-center">Dời hạn</th>
                      <th className="py-1 pl-2 text-left">Gửi CĐT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cacVong.map(v => {
                      const ph = phieuTheoVong[v.vong];
                      const dangChay = v.vong === vong;
                      // CĐT yêu cầu chỉnh ở vòng nào: mỗi lần trả về mở ra vòng kế tiếp, nên lần
                      // điều chỉnh thứ n là chuyện kết thúc vòng n.
                      const cdt = (p.cdtDieuChinh || [])[v.vong - 1];
                      return (
                        <tr key={v.vong} className={`border-b border-slate-100 dark:border-slate-800/60 last:border-0 ${dangChay ? 'bg-brand-accent/[0.06]' : ''}`}>
                          <td className="py-1.5 pr-2 whitespace-nowrap">
                            <span className={`font-black ${dangChay ? 'text-brand-accent dark:text-brand-accent-300' : 'text-slate-600 dark:text-slate-300'}`}>
                              Vòng {v.vong}
                            </span>
                            {dangChay && <span className="ml-1 text-[9px] font-bold text-brand-accent dark:text-brand-accent-300">đang chạy</span>}
                          </td>
                          <td className="py-1.5 px-2 font-mono text-[10.5px] text-slate-600 dark:text-slate-300 whitespace-nowrap">
                            {v.batDau} → {v.ketThuc}
                          </td>
                          <td className="py-1.5 px-2 text-center font-mono text-slate-600 dark:text-slate-300">{v.soNgay ?? '—'}</td>
                          <td className="py-1.5 px-2 text-center">
                            <span className={`font-black ${v.tienDo >= 100 ? 'text-brand-success' : 'text-slate-600 dark:text-slate-300'}`}>{v.tienDo}%</span>
                          </td>
                          <td className="py-1.5 px-2 text-center whitespace-nowrap">
                            {ph ? (
                              <span className="font-bold text-brand-warning" title={ph.khau.length ? `Trễ do: ${ph.khau.map(k => nhanKhauTre(k as 'BO_PHAN' | 'PHONG').chu).join(', ')}` : undefined}>
                                +{ph.soNgay}n · {ph.soPhieu} phiếu
                              </span>
                            ) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                          </td>
                          <td className="py-1.5 pl-2 whitespace-nowrap">
                            {v.ngayGui
                              ? <span className="font-mono text-[10.5px] text-brand-success">{fmtDateVN(v.ngayGui)}</span>
                              : <span className="text-slate-300 dark:text-slate-600">chưa gửi</span>}
                            {cdt && <div className="text-[9.5px] text-brand-danger font-bold">CĐT trả về</div>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Lý do CĐT trả về — phần chữ dài nên để dưới bảng, không nhét vào ô hẹp */}
              {!!p.cdtDieuChinh?.length && (
                <div className="mt-2 pt-2 border-t border-slate-200/70 dark:border-slate-800 space-y-1">
                  {p.cdtDieuChinh.map((c, i) => (
                    <p key={i} className="text-[10.5px] font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
                      <span className="font-black text-brand-danger">Sau vòng {i + 1}</span>
                      <span className="font-mono text-slate-400 dark:text-slate-500"> · {fmtDateVN(c.ngay)}</span> — {c.noiDung}
                    </p>
                  ))}
                </div>
              )}
            </Khoi>
          )}

          {/* NHẬT KÝ GỬI CHỦ ĐẦU TƯ */}
          {!!p.guiCDTLogs?.length && (
            <Khoi icon={<Send className="w-3 h-3" />} tieuDe="Nhật ký gửi Chủ đầu tư">
              <div className="space-y-1">
                {p.guiCDTLogs.map(g => (
                  <div key={g.lan} className="flex items-baseline gap-2 text-[11px]">
                    <span className="font-black text-slate-700 dark:text-slate-200 shrink-0">Lần {g.lan}</span>
                    <span className="font-mono text-slate-500 dark:text-slate-400 shrink-0">{fmtDateVN(g.ngay)}</span>
                    <span className="font-medium text-slate-500 dark:text-slate-400 truncate">{g.nguoiGui || ''}</span>
                  </div>
                ))}
              </div>
            </Khoi>
          )}
        </div>

        {/* CHÂN KHUNG */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 bg-slate-50/70 dark:bg-dark-bg/40">
          <span className="text-[10.5px] font-medium text-slate-400 dark:text-slate-500">
            {onEdit ? 'Bấm "Sửa hồ sơ" để chỉnh và lưu ngay tại đây' : 'Khung xem nhanh — chỉ đọc'}
          </span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose}
              className="px-3 py-2 rounded-lg text-[11px] font-black text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-elevated cursor-pointer">
              Đóng
            </button>
            <button type="button" onClick={onOpenFull}
              title="Mở ở màn Báo Cáo Tiến Độ để xem cùng cả danh sách"
              className="px-3 py-2 rounded-lg text-[11px] font-black border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-elevated flex items-center gap-1.5 cursor-pointer">
              <ExternalLink className="w-3.5 h-3.5" />
              Mở hồ sơ đầy đủ
            </button>
            {/* SỬA & LƯU NGAY TẠI ĐÂY (chị Trâm chốt 12/09/2026). Nút chỉ hiện với cấp có quyền —
                App truyền onEdit hay không đã quyết định điều đó, khung này không tự xét quyền. */}
            {onEdit && (
              <button type="button" onClick={onEdit}
                className="px-3.5 py-2 rounded-lg text-[11px] font-black bg-brand-primary hover:bg-brand-primary-hover text-white flex items-center gap-1.5 cursor-pointer">
                <Pencil className="w-3.5 h-3.5" />
                Sửa hồ sơ
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
