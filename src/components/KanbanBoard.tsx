import { useState, useMemo } from 'react';
import { Project, Staff } from '../types';
import { getInitials, getInitialsColor, getTenderDeadline } from '../App';
import { ChevronLeft, ChevronRight, Lock, LayoutGrid, ClipboardCheck } from 'lucide-react';
import DateInput from './DateInput';
import { tongSoLanGuiCDT, nhanLanGui } from '../utils/guiCDT';
import { namHienTaiVN, fmtDateVN } from '../utils/dateVN';
import { maHoSo } from '../lib/utils';

// 7 bước quy trình thầu trên bảng Kanban.
// Bước 1-2: Level 1 (Trưởng phòng) + Level 2 (Quản lý) đều được thao tác (bộ phận thực hiện).
// Từ bước 3 (Duyệt giá cấp phòng) trở đi: chỉ Level 1 (Trưởng phòng) được chuyển thẻ.
// Bước 6 (Trúng thầu) và 7 (Rớt thầu) là hai trạng thái kết thúc SONG SONG — đều đi ra từ bước 5 (gửi CĐT).
export const KANBAN_STEPS = [
  { id: 1, title: 'Tiếp nhận & Khai báo gói thầu', color: 'border-brand-muted', badge: 'bg-brand-muted/15 text-slate-600 dark:text-slate-300' },
  { id: 2, title: 'Triển khai hồ sơ thầu (TC-TM-KT)', color: 'border-brand-accent-400', badge: 'bg-brand-accent/10 text-brand-accent dark:text-brand-accent-300' },
  { id: 3, title: 'Duyệt hồ sơ thầu cấp phòng', color: 'border-brand-accent-600', badge: 'bg-brand-accent/10 text-brand-accent dark:text-brand-accent-300' },
  { id: 4, title: 'Hồ sơ trình BLĐ / Giám đốc', color: 'border-brand-warning', badge: 'bg-brand-warning/10 text-brand-warning' },
  { id: 5, title: 'Hồ sơ đã gửi CĐT', color: 'border-brand-accent', badge: 'bg-brand-accent/10 text-brand-accent dark:text-brand-accent-300' },
  { id: 6, title: 'Trúng thầu', color: 'border-brand-success', badge: 'bg-brand-success/10 text-brand-success' },
  { id: 7, title: 'Rớt thầu', color: 'border-brand-danger', badge: 'bg-brand-danger/10 text-brand-danger' },
];

// Từ bước này trở đi chỉ Trưởng phòng (Level 1) thao tác — bước 3 Duyệt giá cấp phòng
export const KANBAN_L1_ONLY_FROM = 3;

// ===== QUẢN LÝ (L2) KÉO VỀ BƯỚC 1 ĐƯỢC TỚI BƯỚC NÀO (chị Trâm chốt 12/09/2026) =====
// "Ở bước 5 đổ lại quản lý được quyền kéo về để tạo vòng 2 hoặc đổi phân bổ, cho linh động."
// Hồ sơ đang đứng ở bước <= mốc này thì Quản lý tự kéo về Bước 1 được; bước 6 (Trúng thầu) và
// 7 (Rớt thầu) đã chốt kết quả với CĐT nên vẫn chỉ Trưởng phòng đụng tới.
// LƯU Ý: đây là trần của chiều KÉO VỀ. Chiều ĐẨY TIẾN của L2 vẫn là KANBAN_L1_ONLY_FROM ở trên.
export const KANBAN_KEO_VE_TOI_DA_L2 = 5;

// ===== PHẦN VIỆC CỦA PHÒNG XONG Ở BƯỚC NÀO (chị Trâm chốt 12/09/2026) =====
// "Tiến độ phòng chỉ tính hoàn thành khi kéo từ Bước 3 sang 4. Từ bước 4 sang 5 là tiến độ chiến
//  lược, không tính chung trong tiến độ phòng ban."
//
// LUẬT CŨ lấy mốc là Bước 5 (đã gửi CĐT). Sai với cách Phòng làm việc: khoảng từ lúc trình BLĐ tới
// lúc gửi CĐT phụ thuộc lịch của Ban lãnh đạo, Phòng không quyết được — tính vào đó là chấm tiến độ
// của BLĐ chứ không phải của Phòng, và hồ sơ bị báo trễ oan trong lúc chờ ký.
//
// Hồ sơ đứng từ bước này trở đi = Phòng đã xong phần mình:
//   · Dashboard, Gantt, Báo Cáo Tiến Độ → xếp vào nhóm "Đã xong".
//   · Kanban → vẫn hiện đủ 7 bước để theo dõi tiếp đường đi của hồ sơ.
//   · Thẻ Kanban từ bước này cũng thôi hiện hạn thầu (xem phần vẽ thẻ).
export const BUOC_XONG_PHAN_PHONG = 4;

/**
 * HỒ SƠ CÓ ĐANG TRỄ HẠN THẬT KHÔNG — dùng thay cho `p.trangThai === 'TRE_TIEN_DO'` ở MỌI nơi
 * hiển thị (chị Trâm hỏi 12/09/2026 trước khi lên production: "các dự án đang kẹt tiến độ BGĐ chưa
 * xem ghi trễ hạn, nó còn ghi trễ hạn nữa không?").
 *
 * VẤN ĐỀ: `trangThai` là trường ĐÃ LƯU trong Firestore, không tính lại mỗi lần vẽ. Hồ sơ bị đóng
 * dấu TRE_TIEN_DO từ trước — hồi mốc hoàn thành còn là Bước 5 — thì cái dấu đó nằm luôn trong dữ
 * liệu; đổi mốc sang Bước 4 mà không xét gì thêm thì hồ sơ đang chờ Ban lãnh đạo ký vẫn đỏ y như
 * cũ, và chỉ hết đỏ khi có người mở từng hồ sơ ra bấm Lưu.
 *
 * CÁCH XỬ LÝ: không đụng vào dữ liệu đã lưu (ghi đè hàng loạt lên Firestore là việc nguy hiểm và
 * không cần thiết), chỉ đổi CÁCH ĐỌC: hồ sơ đã qua mốc Phòng xong phần mình thì thôi tính trễ,
 * vì quãng chờ BLĐ ký không thuộc trách nhiệm của Phòng. Dấu cũ vẫn nằm trong dữ liệu, lần nào
 * hồ sơ được lưu lại thì tự chuẩn hoá theo luật mới.
 *
 * ⚠ PHẢI dùng deriveKanbanStep chứ KHÔNG đọc thẳng p.kanbanStep (sửa 14/09/2026 khi rà lại):
 * isWorkDone() bên App.tsx suy bước bằng deriveKanbanStep. Nếu hàm này đọc thô p.kanbanStep thì hai
 * bên lệch nhau ở hồ sơ CŨ chưa từng được xếp cột — ví dụ hồ sơ đã trúng thầu, còn mang dấu
 * TRE_TIEN_DO và kanbanStep trống: deriveKanbanStep suy ra Bước 6 nên isWorkDone coi là "đã xong",
 * còn p.kanbanStep||1 = 1 nên hàm này lại coi là "đang trễ" ⇒ một hồ sơ bị đếm vào CẢ HAI nhóm,
 * biểu đồ Hiện trạng gói thầu cộng dư.
 */
export const dangTreHan = (p: Project): boolean =>
  p.trangThai === 'TRE_TIEN_DO' && deriveKanbanStep(p) < BUOC_XONG_PHAN_PHONG;

// Chuyển bước có hợp lệ không (bước 6 & 7 song song, cùng ra/vào từ bước 5 gửi CĐT)
export const isValidKanbanTransition = (from: number, to: number): boolean => {
  if (from === to) return false;
  if (from >= 1 && from <= 4 && to === from + 1) return true; // tiến tuyến tính 1→...→5
  if (from >= 2 && from <= 5 && to === from - 1) return true; // lùi tuyến tính
  if (from === 5 && (to === 6 || to === 7)) return true;      // rẽ nhánh: gửi CĐT → trúng / rớt
  if ((from === 6 || from === 7) && to === 5) return true;    // quay lại từ trạng thái kết thúc
  return false;
};

// Suy ra bước Kanban mặc định cho hồ sơ chưa từng được xếp cột
export const deriveKanbanStep = (p: Project): number => {
  if (p.kanbanStep && p.kanbanStep >= 1 && p.kanbanStep <= 7) return p.kanbanStep;
  if (p.tinhTrangDuAn === 'Đã trúng thầu') return 6;
  if (p.tinhTrangDuAn === 'Rớt thầu') return 7;
  // Hồ sơ đã đánh dấu hoàn thành mà chưa từng xếp cột: đặt vào đúng mốc "Phòng xong phần mình"
  // (Bước 4 — trình BLĐ), không phải Bước 5 như luật cũ.
  if (p.trangThai === 'HOAN_THANH_DUNG_HAN' || p.trangThai === 'HOAN_THANH_TRE_HAN') return BUOC_XONG_PHAN_PHONG;
  if (p.tienDoBoPhan > 0) return 2;
  return 1;
};

interface KanbanBoardProps {
  projects: Project[];
  staff: Staff[];
  parentNameById?: Record<string, string>;
  currentUserRole?: 'BOOD' | 'MANAGER' | 'STAFF' | 'VIEWER';
  onMove: (projectId: string, fromStep: number, toStep: number) => void;
  onDenied: (message: string) => void;
  onOpenProject: (projectId: string) => void;
  /** Kéo hồ sơ VỀ BƯỚC 1 — mở hộp hỏi "có ảnh hưởng hạn nộp không?" (không chuyển ngay). */
  onPullBackToStart: (projectId: string, fromStep: number) => void;
}

export default function KanbanBoard({ projects, staff, parentNameById = {}, currentUserRole, onMove, onDenied, onOpenProject, onPullBackToStart }: KanbanBoardProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStep, setDragOverStep] = useState<number | null>(null);
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  // MẶC ĐỊNH lọc theo NĂM HIỆN TẠI (chị Trâm chốt 17/08/2026) — tự đổi theo lịch, sang 2027 thì
  // mặc định thành 2027, không phải sửa code lại. Năm lấy theo giờ Việt Nam, không theo giờ máy.
  const [yearFilter, setYearFilter] = useState<string>(() => namHienTaiVN());
  // Lọc theo PHÂN LOẠI HẠNG MỤC (chị chốt qua demo — dễ tìm gói thầu theo loại: báo giá chi tiết,
  // khái toán, phát sinh, cải tạo...). 'ALL' = không lọc, giữ nguyên mọi loại, giống mặc định của
  // ô lọc Năm.
  const [hangMucFilter, setHangMucFilter] = useState<string>('ALL');
  const HANG_MUC_OPTIONS: Project['hangMuc'][] = ['Báo giá chi tiết', 'Khái toán', 'Báo giá phát sinh', 'Cải tạo', 'VE', 'Lập hồ sơ thầu'];

  // ===== NĂM CỦA HỒ SƠ =====
  // Lấy theo NGÀY BẮT ĐẦU — trường này luôn có và luôn là ISO nên không thể suy ra sai.
  //
  // TRƯỚC ĐÂY: cắt 4 chữ số đầu của mã dự án rồi coi đó là năm. Sai với mã kiểu YYMMNN mà Phòng
  // đang dùng — "260002-HPCS-BG-PSD" ra "2600", "261006-HPCS-BG-BMP" ra "2610" — nên ô lọc hiện
  // ra những năm không tồn tại (chị Trâm báo 17/08/2026, kèm ảnh màn hình).
  //
  // Vẫn nhận tiền tố mã, nhưng CHỈ khi đúng dạng "YYYY." có dấu chấm (vd "2026.01") — dạng này
  // không thể nhầm với YYMMNN. Kèm chặn năm vô lý để dữ liệu hỏng không lọt lên ô lọc.
  const namHopLe = (n: number) => n >= 2000 && n <= 2100;
  const projectYear = (p: Project): string => {
    const tuMa = (p.projectId || '').match(/^(\d{4})\./)?.[1];
    if (tuMa && namHopLe(Number(tuMa))) return tuMa;
    const d = new Date(p.ngayBatDau);
    if (isNaN(d.getTime())) return '';
    const nam = d.getFullYear();
    return namHopLe(nam) ? String(nam) : '';
  };
  // Năm hiện tại LUÔN có trong danh sách, kể cả khi chưa có hồ sơ nào của năm đó — nếu không,
  // ô lọc đang chọn mặc định năm hiện tại mà không tìm được <option> khớp thì hiện trống trơ.
  const years = useMemo(
    () => [...new Set([namHienTaiVN(), ...projects.map(projectYear).filter(Boolean)])].sort().reverse(),
    [projects]
  );

  // Lọc hồ sơ theo NĂM + PHÂN LOẠI HẠNG MỤC + khoảng ngày (từ - đến) để bảng không bị "ngộp" khi
  // có hàng trăm dự án. Cả 3 bộ lọc kết hợp được với nhau (AND), không loại trừ nhau.
  const filteredProjects = useMemo(() => {
    const byYear = yearFilter === 'ALL' ? projects : projects.filter(p => projectYear(p) === yearFilter);
    const byHangMuc = hangMucFilter === 'ALL' ? byYear : byYear.filter(p => p.hangMuc === hangMucFilter);
    if (!fromDate && !toDate) return byHangMuc;
    const from = fromDate ? new Date(fromDate).getTime() : -Infinity;
    const to = toDate ? new Date(toDate).getTime() : Infinity;
    return byHangMuc.filter(p => {
      const s = new Date(p.ngayBatDau).getTime();
      const e = new Date(p.ngayHoanThanhThucTe || p.ngayHoanThanhDuKienHienTai || p.ngayHoanThanhDuKienGoc).getTime();
      return s <= to && e >= from; // lịch dự án giao với khoảng lọc
    });
  }, [projects, fromDate, toDate, yearFilter, hangMucFilter]);

  const canMove = (fromStep: number, toStep: number): boolean => {
    if (currentUserRole === 'BOOD') return true;
    if (currentUserRole !== 'MANAGER') return false;
    // Level 2 (Quản lý/bộ phận): thao tác trong bước 1-2 và được ĐẨY LÊN đến bước 3 (Duyệt giá cấp phòng)
    // để báo Trưởng phòng.
    if (fromStep <= 2 && toStep <= KANBAN_L1_ONLY_FROM) return true;
    // ===== MỞ THÊM CHO QUẢN LÝ (chị Trâm chốt 19/09/2026) =====
    // "Mở thêm cho Quản lý tính năng kéo từ Bước 4 qua Bước 5, và từ Bước 5 được click trúng thầu
    //  hay rớt thầu đi ní."
    //   · 4 → 5 : gửi hồ sơ cho Chủ đầu tư. Ban lãnh đạo đã duyệt ở Bước 4 rồi, việc gửi đi là
    //             thao tác hành chính — bắt chờ Trưởng phòng kéo tay chỉ làm chậm ngày gửi.
    //   · 5 → 6/7 : ghi nhận kết quả thầu. Chủ đầu tư báo trúng hay rớt thì ai nghe tin cũng ghi
    //             được, không phải quyết định gì.
    // VẪN GIỮ NGUYÊN chặn 3 → 4: đó là cửa "Phòng xong phần mình", phải do Trưởng phòng chốt tiến
    // độ Phòng 100% và chịu trách nhiệm trước Ban lãnh đạo.
    if (fromStep === 4 && toStep === 5) return true;
    if (fromStep === 5 && (toStep === 6 || toStep === 7)) return true;
    return false;
  };

  const tryMove = (p: Project, toStep: number) => {
    const fromStep = deriveKanbanStep(p);
    if (toStep < 1 || toStep > 7 || toStep === fromStep) return;
    // KÉO VỀ BƯỚC 1 (từ bất kỳ bước nào): không chuyển ngay — mở hộp hỏi ảnh hưởng hạn nộp.
    // Quyền: L1 (BOOD) luôn được; L2 (Quản lý) được kéo về từ BƯỚC 5 TRỞ XUỐNG.
    //
    // Chị Trâm chốt 12/09/2026 — MỞ QUYỀN KÉO VỀ CHO QUẢN LÝ: "ở bước 5 đổ lại quản lý được quyền
    // kéo về để tạo vòng 2 hoặc đổi phân bổ, cho linh động". Trước đây L2 chỉ kéo về được khi hồ sơ
    // CÒN ở bước 1-2, nên mỗi lần cần lập lại kế hoạch là phải nhờ Trưởng phòng kéo tay — nghẽn cổ chai.
    // Chỉ mở đúng chiều KÉO VỀ; trần ĐẨY TIẾN của L2 vẫn dừng ở bước KANBAN_L1_ONLY_FROM (xem canMove).
    // Bước 6 (Trúng thầu) và 7 (Rớt thầu) vẫn chỉ Trưởng phòng — hồ sơ đã chốt kết quả với CĐT.
    if (toStep === 1 && fromStep > 1) {
      if (currentUserRole === 'BOOD' || (currentUserRole === 'MANAGER' && fromStep <= KANBAN_KEO_VE_TOI_DA_L2)) {
        onPullBackToStart(p.id, fromStep);
      } else {
        onDenied(`Hồ sơ đã ở bước ${fromStep} (${KANBAN_STEPS.find(s => s.id === fromStep)?.title}) — chỉ Trưởng phòng (Level 1) kéo về được. Quản lý kéo về Bước 1 từ bước ${KANBAN_KEO_VE_TOI_DA_L2} trở xuống.`);
      }
      return;
    }
    if (!isValidKanbanTransition(fromStep, toStep)) {
      onDenied('Bước chuyển không hợp lệ! (Bước 6 Trúng thầu và 7 Rớt thầu là hai nhánh song song, đều đi ra từ bước 5 Gửi CĐT — không chuyển trực tiếp giữa hai bước này.)');
      return;
    }
    if (!canMove(fromStep, toStep)) {
      onDenied(`Cửa bước ${KANBAN_L1_ONLY_FROM} → 4 (trình Ban lãnh đạo) do Trưởng phòng chốt tiến độ Phòng rồi mới chuyển. Quản lý đẩy được tới bước ${KANBAN_L1_ONLY_FROM}, và từ bước 4 trở đi thao tác được các bước 4 → 5 (gửi CĐT), 5 → 6/7 (trúng / rớt thầu).`);
      return;
    }
    onMove(p.id, fromStep, toStep);
  };

  return (
    <div className="bg-white dark:bg-dark-card p-5 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
        <div className="min-w-0">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <LayoutGrid className="text-brand-accent dark:text-brand-accent-300 w-4 h-4" />
            BẢNG KANBAN QUY TRÌNH THẦU (7 BƯỚC)
          </h3>
          <p className="text-[0.72rem] text-slate-500 dark:text-slate-400 mt-0.5">
            Bước 1-2: Trưởng phòng &amp; Quản lý; Quản lý đẩy được tối đa đến bước {KANBAN_L1_ONLY_FROM} (Duyệt giá cấp phòng) để báo Trưởng phòng, từ đó Trưởng phòng thao tác. Bước 5 rẽ nhánh <b className="text-brand-success">Trúng</b> / <b className="text-brand-danger">Rớt</b>; tình trạng tự cập nhật theo cột.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0 w-full xl:w-auto">
          {/* Lọc nhanh theo NĂM — năm lấy từ ngày bắt đầu hồ sơ (xem projectYear ở trên).
              Mặc định là năm hiện tại theo lịch Việt Nam. */}
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="text-[0.72rem] font-black bg-slate-50 dark:bg-dark-bg/50 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-accent cursor-pointer"
            title="Lọc hồ sơ trên Kanban theo năm"
          >
            <option value="ALL">Tất cả năm</option>
            {years.map(y => <option key={y} value={y}>Năm {y}</option>)}
          </select>
          {/* Lọc nhanh theo PHÂN LOẠI HẠNG MỤC — dùng đúng khuôn ô lọc Năm ở trên, kết hợp được
              với nhau (xem filteredProjects). Giúp tìm nhanh gói thầu theo loại (báo giá chi tiết,
              khái toán, phát sinh, cải tạo...) trên bảng có nhiều thẻ. */}
          <select
            value={hangMucFilter}
            onChange={(e) => setHangMucFilter(e.target.value)}
            className="text-[0.72rem] font-black bg-slate-50 dark:bg-dark-bg/50 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-accent cursor-pointer"
            title="Lọc hồ sơ trên Kanban theo phân loại hạng mục"
          >
            <option value="ALL">Tất cả loại</option>
            {HANG_MUC_OPTIONS.map(h => <option key={h} value={h}>{h}</option>)}
          </select>
          {/* Mobile: dòng lọc thời gian xuống hàng riêng bên dưới (chị chốt 14/07) */}
          {/* KHÔNG đặt biểu tượng lịch trang trí ở đây: mỗi ô DateInput đã có nút lịch riêng
              (thêm ở góp ý #6), để thêm nữa là dòng lọc có 3 cuốn lịch — chị Trâm báo 17/08/2026. */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-dark-bg/50 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 w-full sm:w-auto order-last sm:order-none">
            <DateInput
              value={fromDate}
              onChange={setFromDate}
              className="text-[0.78rem] font-semibold bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none w-24"
              title="Từ ngày"
            />
            <span className="text-slate-400 text-[0.78rem]">→</span>
            <DateInput
              value={toDate}
              onChange={setToDate}
              className="text-[0.78rem] font-semibold bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none w-24"
              title="Đến ngày"
            />
            {(fromDate || toDate) && (
              <button onClick={() => { setFromDate(''); setToDate(''); }} className="text-[0.72rem] font-bold text-brand-danger hover:opacity-75 px-1 shrink-0" title="Xóa lọc ngày">✕</button>
            )}
          </div>
          <span className="text-[0.72rem] bg-brand-accent/10 text-brand-accent dark:text-brand-accent-300 font-black px-2 py-1 rounded-lg whitespace-nowrap">
            {filteredProjects.length} hồ sơ
          </span>
        </div>
      </div>

      {/* Mobile <768px: cột giữ bề rộng đọc được + vuốt ngang xem tiến trình (chị chốt 14/07); md+ giữ lưới 7 cột */}
      <div className="flex overflow-x-auto md:grid md:grid-cols-7 md:overflow-x-visible gap-1 pb-1">
        {KANBAN_STEPS.map(col => {
          const colProjects = filteredProjects.filter(p => deriveKanbanStep(p) === col.id);
          // Ổ KHOÁ chỉ còn ở ĐÚNG cột Trưởng phòng mới thao tác được (19/09/2026). Quản lý nay làm
          // được 4 → 5 và 5 → 6/7, nên treo khoá ở cột 4-5-6-7 là nói sai quyền: người dùng nhìn
          // khoá rồi không dám bấm, trong khi nút vẫn ăn.
          const isL1Zone = col.id === KANBAN_L1_ONLY_FROM;
          const isDragOver = dragOverStep === col.id;
          return (
            <div
              key={col.id}
              onDragOver={(e) => { e.preventDefault(); setDragOverStep(col.id); }}
              onDragLeave={() => setDragOverStep(prev => (prev === col.id ? null : prev))}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverStep(null);
                const projId = e.dataTransfer.getData('text/kanban-project');
                const p = filteredProjects.find(x => x.id === projId);
                if (p) tryMove(p, col.id);
                setDraggingId(null);
              }}
              className={`w-40 shrink-0 md:w-auto md:min-w-0 rounded-lg border-t-[3px] ${col.color} bg-slate-50/70 dark:bg-dark-bg/40 border border-slate-200/60 dark:border-slate-800 flex flex-col transition-colors ${
                isDragOver ? 'ring-2 ring-brand-accent bg-brand-accent/10' : ''
              }`}
            >
              <div className="p-1.5 border-b border-slate-200/60 dark:border-slate-800 space-y-1">
                <div className="flex items-center justify-between gap-1">
                  <span className={`text-[0.66rem] font-black px-1.5 py-0.5 rounded uppercase ${col.badge}`}>Bước {col.id}</span>
                  <div className="flex items-center gap-1">
                    {isL1Zone && (
                      <span title="Chỉ Trưởng phòng (Level 1) được thao tác" className="text-brand-warning">
                        <Lock className="w-3 h-3" />
                      </span>
                    )}
                    <span className="text-[0.66rem] font-black text-slate-400 bg-white dark:bg-dark-card border border-slate-200 dark:border-slate-800 rounded-full px-1.5">
                      {colProjects.length}
                    </span>
                  </div>
                </div>
                <h4 className="text-[0.72rem] font-black text-slate-700 dark:text-slate-200 uppercase leading-tight">{col.title}</h4>
              </div>

              <div className="p-1 space-y-1.5 min-h-[120px] flex-1">
                {colProjects.length === 0 && (
                  <div className="text-center text-[0.62rem] text-slate-300 dark:text-slate-700 italic py-6 select-none">— Trống —</div>
                )}
                {colProjects.map(p => {
                  const step = deriveKanbanStep(p);
                  // CHỮ VIẾT TẮT TRÊN THẺ = QUẢN LÝ CHÍNH của hồ sơ (chị Trâm chốt 12/09/2026).
                  // Trước đây lấy p.thucHienId — người THỰC HIỆN việc con đầu tiên — nên thẻ hiện
                  // "NQ", "NL"... không đúng mục đích: nhìn bảng Kanban là để biết AI ĐANG CẦM hồ sơ
                  // này, tức quản lý phụ trách, chứ không phải ai đang bóc tách khối lượng.
                  const quanLyChinh = staff.find(s => s.id === p.quanLyId);
                  // HẠN THẦU của hồ sơ — cùng nguồn với badge "⏰ Hạn thầu" ở màn Báo Cáo Tiến Độ
                  // (getTenderDeadline), để hai nơi không bao giờ lệch ngày nhau.
                  const hanThau = getTenderDeadline(p);
                  const hanThauISO = hanThau.toISOString().split('T')[0];
                  // Quá hạn: chỉ tính khi hồ sơ CHƯA chốt kết quả. Hồ sơ đã trúng/rớt hoặc đã hoàn
                  // thành thì treo chữ đỏ "quá hạn" là gây hiểu nhầm — việc đã xong rồi.
                  const daChotKetQua = step >= 6
                    || p.trangThai === 'HOAN_THANH_DUNG_HAN' || p.trangThai === 'HOAN_THANH_TRE_HAN';
                  const quaHanThau = !daChotKetQua && hanThauISO < new Date().toISOString().split('T')[0];
                  const parentName = (p.duAnChaId && parentNameById[p.duAnChaId]) || p.tenDuAn;
                  // Bước lùi: 6/7 → 5, còn lại → step-1
                  const backStep = (step === 6 || step === 7) ? 5 : step - 1;
                  const backAllowed = isValidKanbanTransition(step, backStep) && canMove(step, backStep);
                  // ===== NÚT LÙI CỦA QUẢN LÝ = KÉO VỀ BƯỚC 1 (phát hiện khi nghiệm thu 14/09/2026) =====
                  // Từ 12/09 Quản lý ĐƯỢC kéo hồ sơ về Bước 1 từ Bước 5 trở xuống, nhưng KHÔNG được lùi
                  // từng nấc (4→3, 3→2) — đó là khâu duyệt giá của Phòng. Hệ quả trên màn hình: thẻ ở
                  // Bước 3-5 hiện nút ‹ xám ngắt với dòng "Chỉ Trưởng phòng được thao tác vùng này",
                  // nên Quản lý nhìn vào tưởng mình không làm được gì — trong khi quyền vừa được mở.
                  // Nay với Quản lý, nút ‹ làm đúng thao tác lùi DUY NHẤT họ được phép: về thẳng Bước 1.
                  // Trưởng phòng giữ nguyên hành vi cũ (lùi từng nấc).
                  const l2VeBuoc1 = currentUserRole === 'MANAGER' && !backAllowed
                    && step > 1 && step <= KANBAN_KEO_VE_TOI_DA_L2;
                  // Hồ sơ Quản lý vừa lập (hoặc vừa dời hạn) đứng sẵn ở Bước 1 chờ Trưởng phòng
                  // duyệt kế hoạch — KHÔNG cho đẩy thẻ tiến lên bằng tay, duyệt xong hồ sơ tự sang
                  // Bước 2 (chị Trâm chốt 29/07/2026: cứ để nó ở Bước 1 chứ đừng giấu khỏi bảng).
                  // NHÃN CHỜ DUYỆT CHỈ HIỆN Ở BƯỚC 1 (chị Trâm chốt 30/07/2026) — cả "chờ duyệt lần
                  // đầu" lẫn "chờ duyệt lại". Qua được Bước 2 tức là đã có người duyệt, treo nhãn
                  // chờ duyệt ở đó gây hiểu sai.
                  const hienNhanChoDuyet = step === 1 && (p.tpDaDuyet === false || p.choDuyetLai === true);
                  // KHOÁ ĐẨY THẺ thì vẫn xét ở MỌI bước, không theo nhãn: hồ sơ mang cờ chờ duyệt mà
                  // để đẩy tiếp là lách quy trình, và handleKanbanMove bên App cũng chặn — nút hiện
                  // bấm được rồi báo lỗi thì còn khó hiểu hơn. Lý do nằm ở tooltip của nút.
                  const choTPDuyet = p.tpDaDuyet === false || p.choDuyetLai === true;
                  const nextAllowed = step <= 4 && canMove(step, step + 1) && !choTPDuyet;
                  const isBranchStep = step === 5; // rẽ nhánh Trúng / Rớt
                  return (
                    <div
                      key={p.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/kanban-project', p.id);
                        setDraggingId(p.id);
                      }}
                      onDragEnd={() => { setDraggingId(null); setDragOverStep(null); }}
                      className={`bg-white dark:bg-dark-card border border-slate-200/70 dark:border-slate-800 rounded-md p-1.5 space-y-1 shadow-2xs cursor-grab active:cursor-grabbing hover:border-brand-accent-300 dark:hover:border-brand-accent-700 transition-all ${
                        draggingId === p.id ? 'opacity-40' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[0.58rem] font-black font-mono bg-slate-100 dark:bg-dark-elevated text-slate-500 dark:text-slate-400 px-1 py-0.5 rounded truncate">
                          {maHoSo(p)}
                        </span>
                        <span className={`text-[0.58rem] font-black px-1 py-0.5 rounded-full shrink-0 ${
                          dangTreHan(p)
                            ? 'bg-brand-danger/10 text-brand-danger'
                            : 'bg-brand-accent/10 text-brand-accent dark:text-brand-accent-300'
                        }`}>
                          {p.tienDoBoPhan}%
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onOpenProject(p.id)}
                        className="block w-full text-left cursor-pointer group/card"
                        title={`Dự án: ${parentName}\nCông việc: ${p.hangMuc}`}
                      >
                        <div className="text-[0.66rem] font-black text-slate-800 dark:text-slate-200 leading-tight line-clamp-2 group-hover/card:text-brand-accent dark:group-hover/card:text-brand-accent-300 transition-colors flex items-start gap-0.5">
                          <span className="shrink-0">📁</span>
                          <span>{parentName}</span>
                        </div>
                        <span className="inline-block mt-1 text-[0.58rem] font-black uppercase tracking-wide bg-slate-100 dark:bg-dark-elevated text-slate-500 dark:text-slate-400 px-1 py-0.5 rounded leading-none">
                          {p.hangMuc}
                        </span>
                        {/* DÒNG TIẾN ĐỘ (Sếp yêu cầu 08/09/2026: "thêm 1 dòng tiến độ của công việc ở
                            KANBAN để dễ nhìn") — thanh ngang tổng tiến độ (Bộ phận 70% + Phòng 30%,
                            đúng công thức đang dùng ở Gantt/Báo cáo), nhìn lướt cả cột là biết ngay
                            thẻ nào đang chạy nhanh/chậm mà không cần đọc số %. */}
                        {(() => {
                          const tongTienDo = Math.min(100, (p.tienDoBoPhan || 0) * 0.7 + (p.tienDoPhong || 0) * 0.3);
                          const daXong = (p.tienDoBoPhan || 0) >= 100 && (p.tienDoPhong || 0) >= 100;
                          const mauThanh = daXong
                            ? 'bg-brand-success'
                            : dangTreHan(p) ? 'bg-brand-danger' : 'bg-brand-accent';
                          return (
                            <div
                              className="mt-1 h-1.5 w-full bg-slate-100 dark:bg-dark-elevated rounded-full overflow-hidden"
                              title={`Tổng tiến độ ${Math.round(tongTienDo)}% (Bộ phận ${p.tienDoBoPhan || 0}% × 70% + Phòng ${p.tienDoPhong || 0}% × 30%)`}
                            >
                              <div className={`h-full rounded-full transition-all ${mauThanh}`} style={{ width: `${tongTienDo}%` }} />
                            </div>
                          );
                        })()}
                        {/* Nói rõ ngay trên thẻ vì sao nút ► bị khoá — nếu không, người dùng bấm mãi
                            không đi mà chẳng hiểu tại sao (chị Trâm 29/07/2026). */}
                        {hienNhanChoDuyet && (
                          <span
                            className="inline-flex items-center gap-0.5 mt-1 ml-1 text-[0.58rem] font-black uppercase tracking-wide bg-brand-warning/15 text-brand-warning px-1 py-0.5 rounded leading-none"
                            title={!p.choDuyetLai
                              ? 'Quản lý vừa lập kế hoạch — chờ Trưởng phòng mở hồ sơ bấm "Lưu Hồ Sơ". Duyệt xong thẻ TỰ sang Bước 2.'
                              : p.lyDoChoDuyetLai === 'PHAN_BO'
                                ? 'Quản lý chia lại tỉ trọng / thêm việc con — HẠN NỘP KHÔNG ĐỔI. Chờ Trưởng phòng duyệt lại phân bổ.'
                                : 'Kế hoạch vừa bị dời hạn — chờ Trưởng phòng duyệt lại. Duyệt xong hồ sơ mới đẩy thẻ tiếp được.'}
                          >
                            <ClipboardCheck className="w-2.5 h-2.5" />
                            {!p.choDuyetLai
                              ? 'Chờ TP duyệt'
                              : p.lyDoChoDuyetLai === 'PHAN_BO' ? 'Đổi phân bổ' : 'Chờ duyệt lại'}
                          </span>
                        )}
                        {/* Số lần đã gửi CĐT — hiện ngay trên thẻ để TP nhìn bảng là biết hồ sơ
                            đã qua mấy vòng gửi Chủ đầu tư (chi tiết từng lần xem trong hồ sơ). */}
                        {tongSoLanGuiCDT(p) > 0 && (
                          <span
                            className="inline-block mt-1 ml-1 text-[0.58rem] font-black uppercase tracking-wide bg-brand-accent/10 text-brand-accent dark:text-brand-accent-300 px-1 py-0.5 rounded leading-none"
                            title={(p.guiCDTLogs || []).map(l => `Lần ${nhanLanGui(p, l.lan)}: ${l.ngay.split('-').reverse().join('-')} · Phòng ${l.tienDoPhong}%`).join('\n') || 'Số lần gửi khai tay từ trước khi dùng app'}
                          >
                            📤 Gửi CĐT {tongSoLanGuiCDT(p)} lần
                          </span>
                        )}
                        {/* Hồ sơ đang làm lại vòng thứ mấy — tỉ trọng việc con tính riêng theo vòng */}
                        {(p.vongHienTai || 1) > 1 && (
                          <span
                            className="inline-block mt-1 ml-1 text-[0.58rem] font-black uppercase tracking-wide bg-brand-warning/15 text-brand-warning px-1 py-0.5 rounded leading-none"
                            title={`Hồ sơ đang làm lại — vòng ${p.vongHienTai}. Mỗi vòng phân bổ tỉ trọng việc con đủ 100%.`}
                          >
                            🔁 Vòng {p.vongHienTai}
                          </span>
                        )}
                      </button>
                      <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-1 min-w-0">
                          <div
                            className={`w-4 h-4 rounded-full border flex items-center justify-center text-[0.58rem] font-black uppercase shrink-0 ${getInitialsColor(quanLyChinh?.hoTen || '')}`}
                            title={quanLyChinh ? `Quản lý chính: ${quanLyChinh.hoTen}${quanLyChinh.daNghi ? ' (đã nghỉ)' : ''}` : 'Chưa gán quản lý'}
                          >
                            {getInitials(quanLyChinh?.hoTen || '')}
                          </div>
                          {/* HẠN THẦU ngay cạnh tên quản lý (chị Trâm chốt 12/09/2026) — nhìn thẻ là
                              biết hồ sơ này phải nộp ngày nào, khỏi mở hồ sơ ra xem.
                              CHỈ HIỆN TỚI BƯỚC 3: từ Bước 4 (trình BLĐ) trở đi hồ sơ đã ra khỏi tay
                              Phòng, chị Trâm chốt "tới bước BLĐ ai lại đi tính cho BLĐ" — treo hạn ở
                              đó là chấm tiến độ của Ban lãnh đạo, sai đối tượng. */}
                          {step < KANBAN_L1_ONLY_FROM + 1 && (
                            <span
                              className={`text-[0.55rem] font-black whitespace-nowrap leading-none ${
                                quaHanThau ? 'text-brand-danger' : 'text-slate-500 dark:text-slate-400'
                              }`}
                              title={`Hạn thầu (hạn nộp hồ sơ): ${fmtDateVN(hanThauISO)}${quaHanThau ? ' — ĐÃ QUÁ HẠN' : ''}`}
                            >
                              ⏰ {fmtDateVN(hanThauISO)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => tryMove(p, l2VeBuoc1 ? 1 : backStep)}
                            disabled={step <= 1}
                            className={`p-0.5 rounded transition-colors ${
                              step > 1 && (backAllowed || l2VeBuoc1)
                                ? 'text-slate-400 hover:text-brand-accent hover:bg-brand-accent/10 cursor-pointer'
                                : 'text-slate-200 dark:text-slate-700 cursor-not-allowed'
                            }`}
                            title={
                              step <= 1 ? ''
                              : l2VeBuoc1 ? 'Lập lại kế hoạch việc con — đổi phân bổ (hồ sơ đứng nguyên) hoặc dời hạn (kéo về Bước 1)'
                              : backAllowed ? `Lùi về bước ${backStep}`
                              : 'Chỉ Trưởng phòng được thao tác vùng này'
                            }
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                          {isBranchStep ? (
                            <>
                              <button
                                type="button"
                                onClick={() => tryMove(p, 6)}
                                className="w-4 h-4 flex items-center justify-center rounded text-[0.66rem] font-black bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20 transition-colors"
                                title="Đánh dấu Trúng thầu (bước 6)"
                              >
                                ✓
                              </button>
                              <button
                                type="button"
                                onClick={() => tryMove(p, 7)}
                                className="w-4 h-4 flex items-center justify-center rounded text-[0.66rem] font-black bg-brand-danger/10 text-brand-danger hover:bg-brand-danger/20 transition-colors"
                                title="Đánh dấu Rớt thầu (bước 7)"
                              >
                                ✗
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => tryMove(p, step + 1)}
                              disabled={step > 4}
                              className={`p-0.5 rounded transition-colors ${
                                nextAllowed
                                  ? 'text-slate-400 hover:text-brand-accent hover:bg-brand-accent/10 cursor-pointer'
                                  : 'text-slate-200 dark:text-slate-700 cursor-not-allowed'
                              }`}
                              title={step > 4 ? '' : nextAllowed ? `Chuyển sang bước ${step + 1}` : choTPDuyet
                                // Câu này phải đúng ở MỌI bước: thẻ ở Bước 3 mà ghi "tự sang Bước 2" là sai.
                                // Hồ sơ ở Bước 1 thì đúng là duyệt xong tự sang Bước 2, nói riêng ở đó.
                                //
                                // TỪ 18/08/2026 (góp ý #74): Trưởng phòng bấm nút này là app MỞ LUÔN hồ sơ
                                // ra soát, soát xong bấm Lưu là thẻ tự sang Bước 2 — không còn phải tự đi
                                // sang tab Báo Cáo Tiến Độ tìm hồ sơ. Nói đúng việc đó trong tooltip.
                                ? (step === 1
                                  ? (currentUserRole === 'BOOD'
                                    ? 'Bấm để mở hồ sơ soát lại kế hoạch — soát xong bấm "Lưu Hồ Sơ" là thẻ tự sang Bước 2'
                                    : 'Hồ sơ đang chờ Trưởng phòng duyệt kế hoạch — duyệt xong thẻ tự sang Bước 2')
                                  : 'Hồ sơ đang chờ Trưởng phòng duyệt lại kế hoạch — duyệt xong mới đẩy thẻ tiếp được')
                                : 'Chỉ Trưởng phòng được thao tác vùng này'}
                            >
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
