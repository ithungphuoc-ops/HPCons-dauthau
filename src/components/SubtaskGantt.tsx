import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ProjectTask, Staff } from '../types';
import { getInitials, getInitialsColor, chucVuToRole } from '../App';
import { updateTaskInTree, removeTaskFromTree } from '../utils/taskTree';
import { CheckSquare, Square, Plus, Trash2, CalendarClock, Library, ChevronDown, Search } from 'lucide-react';
import DateInput from './DateInput';
import { AutoGrowTextarea } from './ui';
import { TenViecConThuongDung } from '../utils/thuVienViecCon';
import { tinhViTriBangNoi } from '../utils/viTriBangNoi';

interface SubtaskGanttProps {
  tasks: ProjectTask[];
  staff: Staff[];
  projectStartDate: string; // mốc bắt đầu dự án, dùng làm fallback
  canEdit: boolean;
  isBOOD?: boolean; // Trưởng phòng: được nhập cột "TP duyệt" (chiếm 30% trọng số)
  hideFooter?: boolean; // Ẩn dòng chú thích "Tiến độ mỗi việc = 70%+30% · Σ Tỉ trọng" (chế độ xem nhanh cho gọn)
  /** Vòng làm việc đang chạy của hồ sơ (mặc định 1). Việc thêm mới được gắn đúng vòng này;
   *  việc của vòng TRƯỚC bị khoá với Quản lý (Trưởng phòng vẫn sửa được — chị Trâm chốt 25/07/2026). */
  vongHienTai?: number;
  /** ===== THƯ VIỆN TÊN VIỆC CON (chị Trâm — góp ý #62, 18/08/2026) =====
   *  Tên việc con của MỌI hồ sơ, đã đếm số lần xuất hiện và sắp giảm dần (xem
   *  utils/thuVienViecCon.ts). Bấm "Thêm việc con" là xổ danh sách này để chọn, kèm 2 tên thường
   *  gặp nhất đặt sẵn thành nút bấm nhanh. Chọn xong sửa thẳng trên thanh rồi mới bấm Thêm. */
  thuVienTen?: TenViecConThuongDung[];
  onChange: (updatedTasks: ProjectTask[]) => void;
}

// Tiến độ 1 việc con: Bộ phận thực hiện 70% + Trưởng phòng duyệt 30% (mặc định luôn là vậy)
const combinedProgress = (t: { staffProgress?: number; managerProgress?: number; isCompleted?: boolean }) => {
  const sp = t.staffProgress ?? (t.isCompleted ? 100 : 0);
  const mp = t.managerProgress ?? (t.isCompleted ? 100 : 0);
  return Math.round(sp * 0.7 + mp * 0.3);
};

const DAY_MS = 24 * 60 * 60 * 1000;
// Số ngày mặc định cho việc con chưa nhập — dùng CHUNG với planRange bên ProjectForm để không lệch nhau
export const DEFAULT_TASK_DAYS = 3;
const parseDate = (s?: string): Date | null => {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};
const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY_MS);
const shortDate = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;

// ===== NỬA NGÀY LÀ ĐƠN VỊ NHỎ NHẤT (chị Trâm chốt 17/08/2026 — thay cho ô nhập giờ) =====
// "Tính dựa theo 3 ngày hoặc 3.5 ngày, không có số khác, chỉ tính nhỏ nhất là nửa ngày cho nó gọn."
// Người dùng gõ 3.2 / 3.7 gì cũng bị kéo về bội số của 0,5 gần nhất; tối thiểu 0,5 ngày.
export const lamTronNuaNgay = (v: string | number): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return 0.5;
  return Math.max(0.5, Math.round(n * 2) / 2);
};

// ===== MỐC KẾT THÚC THEO SỐ NGÀY (nửa ngày là đơn vị nhỏ nhất) =====
//   · 3 ngày   → bắt đầu 00:00 ngày đầu, hết HẾT ngày thứ 3 (mốc = 00:00 ngày kế tiếp).
//   · 3,5 ngày → làm thêm nửa ngày cuối, hết TRƯA (12:00) của ngày kế tiếp.
const mocTuNgay = (batDau: Date, soNgay: number) => {
  const start = new Date(batDau.getFullYear(), batDau.getMonth(), batDau.getDate());
  const nguyen = Math.floor(soNgay);
  const coNuaNgay = soNgay - nguyen >= 0.5;
  const end = coNuaNgay
    ? new Date(addDays(start, nguyen).getTime() + 12 * 3600000)
    : addDays(start, nguyen);
  return { start, end };
};

// ===== NGÀY CUỐI LÀM VIỆC (chị Trâm báo 18/08/2026: "lỗi phải ko e") =====
// Mốc kết thúc trong app là mốc LOẠI TRỪ:
//   · việc tròn ngày  → mốc = 00:00 ngày KẾ TIẾP  ⇒ ngày cuối làm việc = mốc − 1 ngày
//   · việc có nửa ngày → mốc = 12:00 TRƯA ngày cuối ⇒ ngày cuối làm việc = CHÍNH ngày của mốc
// Bản trước lấy `mốc − 1 ngày` cho MỌI trường hợp, nên việc 29,5 ngày bắt đầu 25/07 (xong trưa 23/08)
// bị ghi là kết thúc 22/08 — sớm một ngày, lại lệch với số ngày in ra ("23/07 → 22/08 = 32 ngày"
// trong khi 23/07 → 22/08 chỉ có 31 ngày).
export const ngayCuoiLamViec = (mocKetThuc: Date): Date => {
  const coGioLe = mocKetThuc.getHours() !== 0 || mocKetThuc.getMinutes() !== 0;
  const d = coGioLe ? mocKetThuc : addDays(mocKetThuc, -1);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

/** Số ngày của một chặng, ĐẾM CẢ HAI ĐẦU: 23/07 → 23/08 = 32 ngày. */
export const demSoNgay = (batDau: Date, mocKetThuc: Date): number => {
  const dau = new Date(batDau.getFullYear(), batDau.getMonth(), batDau.getDate());
  const cuoi = ngayCuoiLamViec(mocKetThuc);
  return Math.max(1, Math.round((cuoi.getTime() - dau.getTime()) / DAY_MS) + 1);
};

/**
 * KHOẢNG KẾ HOẠCH của cả bộ việc con — MỘT NGUỒN DUY NHẤT cho hai chỗ hiển thị:
 * tiêu đề bảng phân rã ("PHÂN RÃ CÔNG VIỆC & SƠ ĐỒ GANTT · 18/08 → 22/08") và dòng "Kế hoạch con"
 * dưới bảng trong form hồ sơ.
 *
 * ⚠ VÌ SAO PHẢI GOM LẠI (chị Trâm báo 18/08/2026): hai chỗ đó trước đây tính bằng hai đoạn code khác
 * nhau — bảng thì xét cả phần cấp 2 và có luật nửa ngày, còn dòng "Kế hoạch con" chỉ cộng
 * `soNgay × 1 ngày` của việc cấp 1 → in ra hai ngày kết thúc khác nhau cho cùng một kế hoạch.
 *
 * Luật (giống hệt phần dựng dòng của bảng):
 *   · việc chưa đặt ngày thì xếp NỐI TIẾP việc trước (cursor), số ngày mặc định DEFAULT_TASK_DAYS;
 *   · việc CÓ phần cấp 2 thì lấy min ngày bắt đầu / max mốc kết thúc CỦA CÁC PHẦN (suy một chiều);
 *   · mốc kết thúc theo luật nửa ngày (xem mocTuNgay).
 */
export const khoangKeHoachViecCon = (
  tasks: ProjectTask[],
  vong: number,
  mocBatDauDuAn?: string,
): { minDate: string; maxDate: string; days: number } | null => {
  const cungVong = (tasks || []).filter(t => (t.vong && t.vong > 0 ? t.vong : 1) === vong);
  if (cungVong.length === 0) return null;
  const goc = parseDate(mocBatDauDuAn) || new Date();
  let cursor = goc;
  let coNgayKhai = false;
  let sMin: Date | null = null;
  let eMax: Date | null = null;
  const ghiNhan = (s: Date, e: Date) => {
    if (!sMin || s < sMin) sMin = s;
    if (!eMax || e > eMax) eMax = e;
  };
  cungVong.forEach(t => {
    const khaiCha = parseDate(t.ngayBatDau);
    if (khaiCha) coNgayKhai = true;
    const chaStart = khaiCha || cursor;
    const chaDays = t.soNgay && t.soNgay > 0 ? t.soNgay : DEFAULT_TASK_DAYS;
    const con = t.subtasks || [];
    if (con.length === 0) {
      const m = mocTuNgay(chaStart, chaDays);
      ghiNhan(m.start, m.end);
      cursor = addDays(m.start, chaDays);
      return;
    }
    let cMin: Date | null = null;
    let cMax: Date | null = null;
    con.forEach(c => {
      const khaiCon = parseDate(c.ngayBatDau);
      if (khaiCon) coNgayKhai = true;
      const m = mocTuNgay(khaiCon || chaStart, c.soNgay && c.soNgay > 0 ? c.soNgay : chaDays);
      if (!cMin || m.start < cMin) cMin = m.start;
      if (!cMax || m.end > cMax) cMax = m.end;
    });
    if (!cMin || !cMax) return;
    ghiNhan(cMin as Date, cMax as Date);
    cursor = addDays(cMin as Date, Math.max(0.5, (((cMax as Date).getTime() - (cMin as Date).getTime()) / DAY_MS)));
  });
  if (!coNgayKhai || !sMin || !eMax) return null;
  return {
    minDate: fmt(sMin as Date),
    maxDate: fmt(ngayCuoiLamViec(eMax as Date)),
    days: demSoNgay(sMin as Date, eMax as Date),
  };
};

// ===== THỜI HẠN CỦA VIỆC CẤP 1 SUY TỪ CÁC PHẦN CẤP 2 — MỘT CHIỀU (chị Trâm chốt 18/08/2026) =====
// "thời hạn bắt đầu của cv con cấp 1 sẽ là thời hạn bắt đầu nhỏ nhất của cv con cấp 2, còn ngày thực
//  hiện sẽ lấy ngày kết thúc muộn nhất của cv con cấp 2, và trừ đi ngày bắt đầu nhỏ nhất của cv con
//  cấp 2 để tính, KHÔNG SUY NGƯỢC LẠI nha em, chỉ suy 1 chiều."
//
// Nghĩa là: người dùng đặt ngày cho TỪNG PHẦN CẤP 2; việc cấp 1 chỉ là cái bao ngoài, ngày bắt đầu
// và số ngày của nó do app tính, không cho gõ tay (nếu cho gõ 2 chiều thì sửa bên nào cũng đè bên
// kia, không bao giờ khớp — đúng cảnh chị Trâm gặp: cha 7 ngày mà 2 phần con còn 3,5).
//
// Hàm này ÁP CHO CẢ CÂY và chạy được nhiều lần cho ra cùng kết quả (idempotent): phần cấp 2 chưa đặt
// ngày riêng thì tạm dùng ngày của việc cha, nên kết quả suy ra vẫn đúng bằng ngày cha đang có.
// ===== TỈ TRỌNG PHẦN CẤP 2 PHẢI CỘNG LẠI BẰNG TỈ TRỌNG VIỆC CẤP 1 =====
// Chị Trâm chốt 18/08/2026: cấp 1 nặng 60% giao 2 người thì mỗi phần 30%; sửa tay 35–25 cũng được,
// miễn tổng vẫn là 60. Những dòng đã chia TRƯỚC bản sửa này còn mang số cũ (chia từ 100 → 50/50 dù
// cha chỉ 34%), nên phải chuẩn hoá lại: GIỮ NGUYÊN TỈ LỆ giữa các phần, chỉ co/giãn cho tổng khớp
// tỉ trọng cha. Nhờ vậy 35–25 do người dùng đặt vẫn đúng ý, còn 50/50 cũ tự về 30/30.
const chuanHoaTiTrongCon = (t: ProjectTask): ProjectTask => {
  const con = t.subtasks || [];
  if (con.length === 0) return t;
  const goc = Math.max(0, t.weight || 0);
  const tong = con.reduce((sm, c) => sm + Math.max(0, c.weight || 0), 0);
  if (tong === goc) return t;                       // đã khớp, không đụng tới
  if (goc === 0) return t;                          // cha chưa có tỉ trọng thì chưa chia được
  // Chia theo đúng tỉ lệ đang có; chưa ai có tỉ trọng thì chia đều.
  const phanTheoTyLe = con.map(c => (tong > 0 ? (Math.max(0, c.weight || 0) / tong) * goc : goc / con.length));
  const lam = phanTheoTyLe.map(x => Math.floor(x));
  let du = goc - lam.reduce((sm, x) => sm + x, 0);   // phần dư do làm tròn: chia lần lượt 1% cho các phần đầu
  const moi = lam.map(x => { const them = du > 0 ? 1 : 0; du -= them; return x + them; });
  return { ...t, subtasks: con.map((c, i) => (c.weight === moi[i] ? c : { ...c, weight: moi[i] })) };
};

export const dongBoNgayChaTuCon = (list: ProjectTask[]): ProjectTask[] =>
  list.map(goc0 => chuanHoaTiTrongCon(goc0)).map(t => {
    const con = t.subtasks || [];
    if (con.length === 0) return t;
    // Không phần nào đặt ngày riêng → không có gì để suy, giữ nguyên việc cha.
    if (!con.some(c => parseDate(c.ngayBatDau))) return t;
    const chaStart = parseDate(t.ngayBatDau);
    const chaDays = t.soNgay && t.soNgay > 0 ? t.soNgay : DEFAULT_TASK_DAYS;
    let sMin: Date | null = null;
    let eMax: Date | null = null;
    con.forEach(c => {
      const batDau = parseDate(c.ngayBatDau) || chaStart;
      if (!batDau) return;
      const m = mocTuNgay(batDau, c.soNgay && c.soNgay > 0 ? c.soNgay : chaDays);
      if (!sMin || m.start < sMin) sMin = m.start;
      if (!eMax || m.end > eMax) eMax = m.end;
    });
    if (!sMin || !eMax) return t;
    const soNgay = lamTronNuaNgay(((eMax as Date).getTime() - (sMin as Date).getTime()) / DAY_MS);
    return { ...t, ngayBatDau: fmt(sMin as Date), soNgay };
  });

/**
 * Ô nhập SỐ NGÀY — nửa ngày là đơn vị nhỏ nhất.
 *
 * ⚠ VÌ SAO PHẢI TÁCH RA THÀNH PHẦN RIÊNG (chị Trâm báo 18/08/2026: "c thêm 0.5 ngày app đọc ko hiểu"):
 * bản cũ gọi `lamTronNuaNgay` NGAY TRONG onChange, tức làm tròn theo TỪNG KÝ TỰ vừa gõ. Gõ "3.5" thì
 * sau ký tự "3" ô đã chốt thành 3, ký tự "5" gõ tiếp thành "35" → ra 35 ngày. Gõ kiểu Việt Nam "3,5"
 * thì <input type="number"> của trình duyệt coi dấu phẩy là không hợp lệ, trả về chuỗi rỗng → về 0,5.
 *
 * Nay: trong lúc gõ thì GIỮ NGUYÊN chữ người dùng nhập (ô type="text" nên "3," hay "3." đều hiện
 * được), chỉ chuẩn hoá về bội số 0,5 khi RỜI Ô hoặc bấm Enter. Chị Trâm chốt 18/08: "cứ khai dùng
 * chung dấu chấm và dấu phẩy như nhau" → cả "3.5" và "3,5" đều ra 3,5. Mũi tên ↑/↓ vẫn nhảy 0,5 để
 * ai quen bấm mũi tên như ô số vẫn dùng được.
 */
function ONhapSoNgay({ giaTri, disabled, ghiChu, onChot }: { giaTri: number; disabled: boolean; ghiChu?: string; onChot: (n: number) => void }) {
  const [chu, setChu] = useState<string>(() => soNgayGon(giaTri));
  const [dangSua, setDangSua] = useState(false);

  // Số ngày đổi từ nơi khác (kéo lịch, chia việc…) mà mình KHÔNG đang gõ thì hiện theo giá trị mới.
  useEffect(() => { if (!dangSua) setChu(soNgayGon(giaTri)); }, [giaTri, dangSua]);

  const chot = (nguon: string) => {
    const n = lamTronNuaNgay(nguon);
    setChu(soNgayGon(n));
    setDangSua(false);
    if (n !== giaTri) onChot(n);
  };

  // ===== TRẢ LẠI NÚT MŨI TÊN LÊN/XUỐNG (chị Trâm báo 18/08/2026: "sao nút mũi tên lên xuống số ngày
  // mất tiêu òi e") =====
  // Mục #70 phải đổi ô này từ <input type="number"> sang ô CHỮ để gõ được "3,5" kiểu Việt Nam và để
  // không làm tròn theo từng ký tự — đổi thế thì mất luôn cặp mũi tên do trình duyệt tự vẽ.
  // Nay tự vẽ 2 nút ▲▼ bên cạnh, mỗi lần bấm nhảy 0,5 — giữ được cả hai: vẫn gõ dấu phẩy, vẫn có mũi tên.
  const nhay = (buoc: number) => chot(String(lamTronNuaNgay(chu) + buoc));

  return (
    <span className="inline-flex items-center gap-0.5">
      <input
        type="text"
        inputMode="decimal"
        value={chu}
        disabled={disabled}
        onFocus={(e) => { setDangSua(true); e.currentTarget.select(); }}
        onChange={(e) => { setDangSua(true); setChu(e.target.value); }}
        onBlur={(e) => chot(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); chot(e.currentTarget.value); e.currentTarget.blur(); return; }
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            nhay(e.key === 'ArrowUp' ? 0.5 : -0.5);
          }
        }}
        title={ghiChu || "Số ngày làm việc — nhỏ nhất là nửa ngày. Gõ 3 hoặc 3,5 (dấu chấm hay dấu phẩy đều được); bấm ▲▼ hoặc mũi tên ↑↓ nhảy 0,5."}
        className="w-11 px-1 py-1 text-[10px] font-black text-center bg-slate-50 dark:bg-dark-bg border border-slate-200 dark:border-slate-700 rounded text-slate-700 dark:text-slate-200 disabled:opacity-70 focus:ring-1 focus:ring-brand-accent focus:outline-none"
      />
      {!disabled && (
        <span className="flex flex-col shrink-0">
          <button
            type="button"
            tabIndex={-1}
            onClick={() => nhay(0.5)}
            title="Thêm nửa ngày (+0,5)"
            aria-label="Thêm nửa ngày"
            className="h-[11px] w-3.5 flex items-center justify-center rounded-t border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-dark-bg text-slate-500 dark:text-slate-400 hover:text-brand-accent hover:border-brand-accent/60 leading-none text-[7px] cursor-pointer"
          >
            ▲
          </button>
          <button
            type="button"
            tabIndex={-1}
            onClick={() => nhay(-0.5)}
            title="Bớt nửa ngày (−0,5)"
            aria-label="Bớt nửa ngày"
            className="h-[11px] w-3.5 flex items-center justify-center rounded-b border border-t-0 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-dark-bg text-slate-500 dark:text-slate-400 hover:text-brand-accent hover:border-brand-accent/60 leading-none text-[7px] cursor-pointer"
          >
            ▼
          </button>
        </span>
      )}
    </span>
  );
}

/** Số ngày hiển thị gọn: 3 → "3", 3.5 → "3,5" (dấu phẩy kiểu Việt Nam). */
export const soNgayGon = (n: number): string =>
  Number.isInteger(n) ? String(n) : String(n).replace('.', ',');

/**
 * Tên hiển thị trong bảng việc con: chỉ HỌ + TÊN, bỏ chữ lót (chị Trâm chốt 18/08/2026).
 * "Nguyễn Cảnh Hồng Quân" → "Nguyễn Quân" · "Lộc" → "Lộc". Cột hẹp nên tên đầy đủ bị cắt,
 * mà chỉ hiện mỗi tên riêng thì hai người trùng tên không phân biệt được.
 */
export const tenHoVaTen = (hoTen?: string): string => {
  const phan = (hoTen || '').trim().split(/\s+/).filter(Boolean);
  if (phan.length <= 1) return phan[0] || '';
  return `${phan[0]} ${phan[phan.length - 1]}`;
};

// Bảng phân rã công việc con GỘP với sơ đồ Gantt: mỗi dòng là 1 việc con
// (tick xong · tên · tỉ trọng · người giao · ngày bắt đầu · số ngày · thanh Gantt).
// Chọn/sửa bên trái thì thanh Gantt bên phải chạy theo ngay. Không dùng thanh kéo ngang.
export default function SubtaskGantt({ tasks, staff, projectStartDate, canEdit, isBOOD = false, hideFooter = false, vongHienTai = 1, thuVienTen = [], onChange }: SubtaskGanttProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newWeight, setNewWeight] = useState(20);
  // Thư viện tên việc con: danh sách đang mở hay không + ô gõ tìm trong thư viện (góp ý #62)
  // ===== HỒ SƠ SANG VÒNG 2 THÌ CHỈ HIỆN VÒNG ĐANG CHẠY (chị Trâm chốt 18/08/2026) =====
  // "nếu đã tới bước lũy kế vòng 2 thì chỉ hiện tiến độ gant chỗ vòng 2 thôi cho nó gọn."
  // Mặc định bảng chỉ liệt kê việc của VÒNG HIỆN TẠI; vòng trước gập lại sau một nút để vẫn tra
  // cứu được (không xoá khỏi tầm mắt hẳn — vòng 1 là bằng chứng của lần báo giá trước).
  const [hienVongTruoc, setHienVongTruoc] = useState(false);
  const [moThuVien, setMoThuVien] = useState(false);
  const [timThuVien, setTimThuVien] = useState('');
  // ===== CHIA MỘT VIỆC CON CHO NHIỀU NGƯỜI (chị Trâm — góp ý #7) =====
  // "Thêm mục 1 công việc con nhiều người làm, phân bổ qua công việc của các thành viên, tỷ trọng
  //  chia đều." → Bấm vào ô "Người giao" là xổ danh sách; bấm tên nào chọn tên đó, bấm lại thì bỏ.
  // Chọn từ 2 người là app TỰ tách việc thành các phần con (mỗi người một phần, tỉ trọng chia đều).
  // Tiến độ việc cha tự cộng lại từ các phần (getTaskProgress trong utils/taskTree tính theo tỉ trọng).
  // Việc con đang mở danh sách chọn người (bấm vào ô Người giao)
  const [chiaViecId, setChiaViecId] = useState<string | null>(null);
  // ===== TICK TÊN LÀ CHIA NGAY, KHÔNG CẦN BẤM "XONG" (chị Trâm chốt lại 18/08/2026) =====
  // "việc bấm chọn chữ xong lại nằm ở cuối, làm c bấm ra ngoài thì ko tự phân rã, sau khi bấm tick
  //  2 tên là bên ngoài chủ động luôn e, ko cần bấm xong."
  //
  // Bản trước giữ danh sách đang tick trong một BẢN NHÁP rồi mới áp dụng lúc đóng ô. Hai chỗ dở:
  //   1. Nút "Xong" nằm cuối danh sách 9 người nên phải cuộn xuống mới thấy.
  //   2. Hàm bắt sự kiện "bấm ra ngoài" chỉ được gắn lại khi ĐỔI dòng đang mở, nên nó giữ bản nháp
  //      của lúc mới mở (giá trị cũ) → bấm ra ngoài là áp danh sách cũ, KHÔNG chia gì cả.
  // Nay bỏ hẳn bản nháp: tick tên nào là áp dụng ngay tên đó, phần cấp 2 sinh/chia lại tức thì; ô vẫn
  // mở để tick tiếp người thứ 3, bấm ra ngoài chỉ để ĐÓNG. Không còn đường nào làm mất thao tác.
  // ===== DANH SÁCH CHỌN NGƯỜI BỊ KHUNG BẢNG CẮT (chị Trâm báo 18/08/2026, kèm ảnh) =====
  // Danh sách trước đây là `absolute` nằm TRONG ô bảng, mà bảng việc con có `overflow-x-auto` và thẻ
  // bọc ngoài có `overflow-hidden` → phần danh sách tràn ra khỏi khung bị CẮT, đè lên dòng tiêu đề
  // và sinh thêm thanh cuộn. Cùng đúng loại lỗi với lịch chọn ngày (mục #22) nên chữa cùng cách:
  // đưa danh sách ra ngoài <body> bằng portal, dùng position: fixed, tự lật lên/kéo vào khi hết chỗ,
  // cuộn hay đổi cỡ cửa sổ thì tính lại toạ độ.
  // ⚠ KHÔNG DÙNG REF DÙNG CHUNG cho mọi dòng (chị Trâm báo 18/08/2026: "bản trên web vẫn bị nhảy cái
  // khung chọn tên ng thực hiện cv con"). Bản trước gắn `ref={chiaViecId === task.id ? oNguoiLam : undefined}`
  // — một biến ref cho tất cả các dòng. Khi đổi dòng đang mở, React gắn ref cho dòng mới rồi mới tháo
  // ref của dòng cũ, nên lúc đo toạ độ biến ref vẫn đang trỏ vào DÒNG CŨ → bảng nhảy lên đúng một dòng
  // (đo được: bảng ở top 583 trong khi nút vừa bấm ở top 669).
  // Nay giữ ĐÚNG phần tử vừa bấm (lấy từ chính sự kiện click) nên không thể trỏ sai dòng.
  const [oNeoChon, setONeoChon] = useState<HTMLElement | null>(null);
  const [viTriChon, setViTriChon] = useState<{ top: number; left: number } | null>(null);
  const RONG_CHON = 208;   // = w-52
  const CAO_CHON = 288;    // ~ max-h-64 + đệm

  // ĐẶT BẢNG CHỌN TÊN NGAY BÊN CẠNH Ô "NGƯỜI THỰC HIỆN" (chị Trâm chốt 18/08/2026:
  // "render lại cho cái bảng chọn tên nằm bên cạnh nút chọn người giao việc").
  // Trước đây đổ XUỐNG DƯỚI ô nên bảng che mất mấy dòng việc con bên dưới và nhìn rời rạc, không
  // biết nó thuộc dòng nào. Nay: mặc định đặt SÁT PHẢI ô, mép trên thẳng với ô; hết chỗ bên phải thì
  // lật sang BÊN TRÁI; vẫn kẹp vào trong tầm nhìn theo chiều dọc để không bị cắt.
  // Dùng LUẬT CHUNG cho mọi bảng xổ ra (utils/viTriBangNoi.ts — chị Trâm chốt 18/08/2026):
  // sát bên phải ô vừa bấm, hết chỗ thì lật sang trái, không bao giờ đè lên ô đó.
  const tinhViTriChon = useCallback(() => {
    const o = oNeoChon?.getBoundingClientRect();
    if (!o) return;
    setViTriChon(tinhViTriBangNoi(o, RONG_CHON, CAO_CHON));
  }, [oNeoChon]);

  // Bấm ra ngoài là đóng danh sách. Danh sách nay nằm ở <body> nên phải loại trừ CẢ hộp danh sách
  // (thẻ có data-danh-sach-nguoi) lẫn ô "Người thực hiện" đã bấm, nếu không vừa mở đã tự đóng.
  useEffect(() => {
    if (!chiaViecId) return;
    const bamNgoai = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (oNeoChon?.contains(t)) return;
      if ((t as HTMLElement).closest?.('[data-danh-sach-nguoi]')) return;
      setChiaViecId(null);   // đã áp dụng ngay lúc tick, bấm ra ngoài chỉ để đóng
      setONeoChon(null);
    };
    document.addEventListener('mousedown', bamNgoai);
    return () => document.removeEventListener('mousedown', bamNgoai);
  }, [chiaViecId, oNeoChon]);

  useEffect(() => {
    if (!chiaViecId) { setViTriChon(null); return; }
    tinhViTriChon();
    const lai = () => tinhViTriChon();
    // pha capture để nhận cả cuộn của khung bên trong (bảng việc con cuộn ngang)
    window.addEventListener('scroll', lai, true);
    window.addEventListener('resize', lai);
    return () => {
      window.removeEventListener('scroll', lai, true);
      window.removeEventListener('resize', lai);
    };
  }, [chiaViecId, tinhViTriChon]);

  // Nhân sự giao việc được: bỏ người đã nghỉ và bỏ tài khoản Khách - chỉ xem (Level 4) — khách mời
  // không phải nhân sự phòng, không nhận việc được (chị Trâm chốt 27/07/2026).
  const activeStaff = staff.filter(s => !s.daNghi && (s.role || chucVuToRole(s.chucVu)) !== 'VIEWER');
  const baseStart = parseDate(projectStartDate) || new Date();

  // MỌI thay đổi đi qua đây: sau khi sửa thì suy lại ngày của việc cấp 1 từ các phần cấp 2
  // (một chiều — xem dongBoNgayChaTuCon). Nhờ vậy dữ liệu lưu xuống đã đúng, các màn khác
  // (hạn của nhân sự, mốc kết thúc dự án, biểu đồ Gantt lớn) không phải tính lại kiểu khác.
  const guiThayDoi = (next: ProjectTask[]) => onChange(dongBoNgayChaTuCon(next));

  // TỰ SỬA DỮ LIỆU CHIA TỪ TRƯỚC BẢN SỬA (chị Trâm báo 18/08/2026: cha 34% mà 2 phần con vẫn 50/50).
  // Chuẩn hoá đúng MỘT LẦN khi mở bảng ở chế độ sửa; không đổi gì thì không gọi onChange để khỏi
  // làm form "bẩn" vô cớ. Chế độ chỉ-xem không tự ghi.
  useEffect(() => {
    if (!canEdit) return;
    const chuan = dongBoNgayChaTuCon(tasks);
    if (JSON.stringify(chuan) !== JSON.stringify(tasks)) onChange(chuan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit, tasks]);

  const patch = (taskId: string, p: Partial<ProjectTask>) => guiThayDoi(updateTaskInTree(tasks, taskId, () => p));
  const remove = (taskId: string) => guiThayDoi(removeTaskFromTree(tasks, taskId));
  const addTask = () => {
    const name = newName.trim();
    if (!name) return;
    // Việc mới luôn thuộc VÒNG ĐANG CHẠY để tính tỉ trọng 100% theo từng vòng.
    const newTask: ProjectTask = { id: `T-${Date.now()}`, name, weight: Math.max(0, newWeight), isCompleted: false, staffProgress: 0, managerProgress: 0, subtasks: [], assignedStaffIds: [], soNgay: DEFAULT_TASK_DAYS, vong: vongHienTai };
    guiThayDoi([...tasks, newTask]);
    // Gợi ý tỉ trọng cho lần thêm kế tiếp = phần còn thiếu cho đủ 100% của vòng này
    const conThieu = Math.max(0, 100 - (totalWeight + newTask.weight));
    setNewName(''); setNewWeight(conThieu > 0 ? conThieu : 0); setShowAdd(false); setMoThuVien(false); setTimThuVien('');
  };

  /** Những người đang làm một việc con: gán đích danh + danh sách người cùng làm. */
  const nguoiCuaViec = (t: ProjectTask): string[] =>
    Array.from(new Set([t.assignedTo, ...(t.assignedStaffIds || [])].filter(Boolean) as string[]));

  /**
   * Đặt người làm cho một việc con (chị Trâm chốt 17/08/2026 — bấm chọn nhiều người, không nút phụ).
   *   · 0 người  → bỏ gán, xoá các phần đã chia.
   *   · 1 người  → việc của riêng người đó, gộp lại nếu trước đó đang chia.
   *   · ≥2 người → TỰ tách thành các phần con, mỗi người một phần, TỈ TRỌNG CHIA ĐỀU
   *                (phần dư dồn cho người đầu để tổng đúng 100%).
   * Người đã có phần việc từ lần chia trước thì GIỮ NGUYÊN phần đó (không mất tiến độ đã làm).
   */
  // ===== CHIA MỘT VIỆC CẤP 1 CHO NHIỀU NGƯỜI (chị Trâm chốt lại 18/08/2026) =====
  // "nếu 1 cv con cấp 1 giao cho 2ng, thì 2 công việc con nhỏ cấp 2 đó phải lấy tỷ lệ lớn (60%) chia
  //  cho tỷ lệ nhỏ (mỗi cv con cấp 2 30%), hoặc nếu người nhập muốn sửa 35%-25% trong tỷ lệ nhỏ cũng
  //  đc, tùy họ, còn lúc e tự sinh ra thì e phải chia đều."
  //
  // ⚠ SỬA LỖI CŨ: bản trước chia từ 100 (`Math.floor(100 / danh.length)`) nên việc cấp 1 nặng 60% mà
  // mỗi phần cấp 2 lại ra 50% — đọc lên vô nghĩa. Nay chia từ ĐÚNG tỉ trọng của việc cấp 1.
  // Phần dư chia lần lượt 1% cho các phần đầu để tổng khớp đúng tỉ trọng cha (60/7 → 9,9,9,8,8,8,8).
  // Người dùng sửa tay 35–25 thì app KHÔNG đụng nữa; chỉ khi tự sinh (thêm/bớt người) mới chia đều lại.
  //
  // Tổng tỉ trọng 100% của một vòng chỉ tính việc CẤP 1 (xem weightIssue trong utils/taskTree.ts),
  // nên phần cấp 2 cộng lại bằng tỉ trọng cha là đúng, không làm lệch luật Σ = 100%.
  const datNguoiLam = (t: ProjectTask, ids: string[]) => {
    const danh = Array.from(new Set(ids.filter(Boolean)));
    if (danh.length === 0) {
      patch(t.id, { assignedTo: undefined, assignedStaffIds: [], subtasks: [] });
      return;
    }
    if (danh.length === 1) {
      patch(t.id, { assignedTo: danh[0], assignedStaffIds: danh, subtasks: [] });
      return;
    }
    const goc = Math.max(0, t.weight || 0);          // tỉ trọng của việc cấp 1 — chia từ đây
    const moiPhan = Math.floor(goc / danh.length);
    const du = goc - moiPhan * danh.length;
    const conCu = t.subtasks || [];
    const conMoi: ProjectTask[] = danh.map((id, i) => {
      const daCo = conCu.find(c => (c.assignedTo || (c.assignedStaffIds || [])[0]) === id);
      const ten = staff.find(x => x.id === id)?.hoTen || 'Chưa gán';
      const phan = moiPhan + (i < du ? 1 : 0);
      // Người đã có phần từ trước: GIỮ NGUYÊN tiến độ, kết quả, ngày riêng — chỉ chia lại tỉ trọng.
      if (daCo) return { ...daCo, weight: phan };
      return {
        id: `T-${Date.now()}-${i}`,
        name: `${t.name} — ${ten}`,
        weight: phan,
        isCompleted: false,
        staffProgress: 0,
        managerProgress: 0,
        subtasks: [],
        assignedTo: id,
        assignedStaffIds: [id],
        // Ngày khởi điểm lấy theo việc cấp 1 để có số mà suy ngược lên; sau đó mỗi người tự đặt
        // ngày riêng, và ngày của việc cấp 1 sẽ tính lại từ các phần này (một chiều).
        ngayBatDau: t.ngayBatDau,
        soNgay: t.soNgay,
        vong: vongCua(t),
      };
    });
    // Việc cha giữ ĐỦ danh sách người tham gia — RBAC gom `thucHienIds` từ đây nên ai cũng thấy việc.
    patch(t.id, { subtasks: conMoi, assignedTo: danh[0], assignedStaffIds: danh });
  };

  // TỰ CHIA % ĐÓNG GÓP (chị Trâm chốt 26/07/2026): phần % còn thiếu cho đủ 100% được chia ĐỀU cho
  // những việc con CHƯA ĐẶT tỉ trọng (đang để 0). Việc nào Quản lý đã tự gõ số thì GIỮ NGUYÊN,
  // không đụng tới. Nếu mọi việc đều đã có số thì chia đều lại toàn bộ cho đủ 100%.
  // Chia phần dư cho việc đầu tiên để tổng khớp đúng 100%, không lẻ ra 99% hay 101%.
  const chiaDeuTiTrong = () => {
    const cungVong = tasks.filter(t => vongCua(t) === vongHienTai);
    if (cungVong.length === 0) return;
    const chuaDat = cungVong.filter(t => !t.weight);
    const nhomChia = chuaDat.length > 0 ? chuaDat : cungVong;
    const daDat = chuaDat.length > 0
      ? cungVong.filter(t => !!t.weight).reduce((s, t) => s + (t.weight || 0), 0)
      : 0;
    const conLai = Math.max(0, 100 - daDat);
    const moiViec = Math.floor(conLai / nhomChia.length);
    const du = conLai - moiViec * nhomChia.length;
    const idNhan: Record<string, number> = {};
    nhomChia.forEach((t, i) => { idNhan[t.id] = moiViec + (i === 0 ? du : 0); });
    guiThayDoi(tasks.map(t => (idNhan[t.id] !== undefined ? { ...t, weight: idNhan[t.id] } : t)));
  };

  // Tính mốc bắt đầu/kết thúc từng việc: ưu tiên ngày đã đặt; trống thì xếp nối tiếp.
  // NỬA NGÀY (chị Trâm chốt 17/08/2026 — thay ô giờ): soNgay là bội số của 0,5.
  //   · 3 ngày   → bắt đầu 00:00 ngày đầu, hết HẾT ngày thứ 3 (23:59:59).
  //   · 3,5 ngày → làm thêm nửa ngày cuối, hết TRƯA (12:00) của ngày thứ 4.
  // Thanh Gantt vẽ theo mốc ms nên tự ngắn đúng nửa ô ngày, không phải sửa phần vẽ.
  let cursor = baseStart;
  const mocCuaViec = (t: ProjectTask, startNgayVao: Date) => {
    const days = t.soNgay && t.soNgay > 0 ? t.soNgay : DEFAULT_TASK_DAYS;
    const start = new Date(startNgayVao.getFullYear(), startNgayVao.getMonth(), startNgayVao.getDate());
    const nguyen = Math.floor(days);
    const coNuaNgay = days - nguyen >= 0.5;
    // Hết ngày cuối = 00:00 của ngày kế tiếp; nửa ngày thì dừng ở 12:00 trưa ngày kế tiếp.
    const end = coNuaNgay
      ? new Date(addDays(start, nguyen).getTime() + 12 * 3600000)
      : addDays(start, nguyen);
    return { start, days, end, startNgay: start };
  };
  // Danh sách dòng của bảng: việc con cấp 1, và NGAY DƯỚI mỗi việc là các phần đã chia cho từng
  // thành viên (góp ý #7) — thụt lề để nhìn ra quan hệ cha/con, vẫn sửa được từng dòng.
  const rows: { task: ProjectTask; start: Date; days: number; end: Date; depth: number }[] = [];
  // Vòng của một việc con (thiếu = vòng 1). Khai TRƯỚC phần dựng dòng vì phần đó dùng ngay.
  const vongCua = (t: ProjectTask) => (t.vong && t.vong > 0 ? t.vong : 1);

  // Chỉ dựng dòng cho vòng đang chạy (xem hienVongTruoc). Việc của vòng trước vẫn nằm trong `tasks`
  // nên tổng tỉ trọng lũy kế và tiến độ không bị ảnh hưởng — đây chỉ là chuyện HIỂN THỊ.
  const vieThayTrenBang = hienVongTruoc ? tasks : tasks.filter(t => vongCua(t) === vongHienTai);
  vieThayTrenBang.forEach(t => {
    const explicitStart = parseDate(t.ngayBatDau);
    const con = t.subtasks || [];
    if (con.length === 0) {
      const m = mocCuaViec(t, explicitStart || cursor);
      rows.push({ task: t, start: m.start, days: m.days, end: m.end, depth: 0 });
      cursor = addDays(m.startNgay, m.days);   // việc kế tiếp vẫn xếp nối theo NGÀY như trước
      return;
    }
    // ===== CÓ PHẦN CẤP 2: TÍNH CÁC PHẦN TRƯỚC, RỒI SUY VIỆC CẤP 1 (một chiều) =====
    // Chị Trâm chốt 18/08/2026: cấp 1 bắt đầu = ngày bắt đầu NHỎ NHẤT của cấp 2; số ngày của cấp 1
    // = ngày kết thúc MUỘN NHẤT của cấp 2 trừ ngày bắt đầu nhỏ nhất đó. Không suy ngược lại.
    const chaStart = explicitStart || cursor;
    const chaDays = t.soNgay && t.soNgay > 0 ? t.soNgay : DEFAULT_TASK_DAYS;
    const dongCon = con.map(c => {
      // Phần cấp 2 chưa đặt ngày riêng thì tạm dùng lịch của việc cha để còn suy ra được.
      const cStart = parseDate(c.ngayBatDau) || chaStart;
      const mc = mocCuaViec({ ...c, soNgay: c.soNgay && c.soNgay > 0 ? c.soNgay : chaDays }, cStart);
      return { task: c, start: mc.start, days: mc.days, end: mc.end, depth: 1 };
    });
    const sMin = dongCon.reduce((m, r) => (r.start < m ? r.start : m), dongCon[0].start);
    const eMax = dongCon.reduce((m, r) => (r.end > m ? r.end : m), dongCon[0].end);
    const ngayCha = lamTronNuaNgay((eMax.getTime() - sMin.getTime()) / DAY_MS);
    rows.push({ task: t, start: sMin, days: ngayCha, end: eMax, depth: 0 });
    dongCon.forEach(r => rows.push(r));
    cursor = addDays(sMin, ngayCha);
  });
  const minStart = rows.reduce((m, r) => (r.start < m ? r.start : m), rows[0]?.start || baseStart);
  const maxEnd = rows.reduce((m, r) => (r.end > m ? r.end : m), rows[0]?.end || addDays(baseStart, 1));
  const totalDays = Math.max(1, Math.round((maxEnd.getTime() - minStart.getTime()) / DAY_MS));
  // Tổng tỉ trọng — phải đủ 100% TRONG TỪNG VÒNG. Lũy kế = 100% × số vòng (2 lần báo giá → 200%).
  const soVong = Math.max(vongHienTai, tasks.reduce((m, t) => Math.max(m, vongCua(t)), 0));
  const soViecVongTruoc = tasks.filter(t => vongCua(t) < vongHienTai).length;
  const totalWeight = tasks.filter(t => vongCua(t) === vongHienTai).reduce((s, t) => s + (t.weight || 0), 0);
  const luyKeWeight = tasks.reduce((s, t) => s + (t.weight || 0), 0);
  // Việc của vòng trước: Quản lý chỉ xem, Trưởng phòng vẫn sửa được.
  const khoaViec = (t: ProjectTask) => vongCua(t) < vongHienTai && !isBOOD;
  // Mốc ngày trên trục Gantt (4 mốc: đầu → cuối) để dễ hình dung lịch.
  // Hiển thị NGÀY CUỐI LÀM VIỆC (bắt đầu 15, 3 ngày → xong 17), không phải ngày kế tiếp.
  const lastWorkDay = ngayCuoiLamViec(maxEnd);
  const axisTicks = [0, 1 / 3, 2 / 3, 1].map(f => shortDate(addDays(minStart, Math.round(Math.max(0, totalDays - 1) * f))));

  return (
    <div className="bg-white dark:bg-dark-card border border-slate-200/60 dark:border-slate-800 rounded-xl overflow-hidden">
      {/* Header + nút thêm việc */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-100 dark:border-slate-800">
        <span className="text-[11px] font-black uppercase tracking-wide text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
          <CalendarClock className="w-4 h-4 text-brand-accent" />
          Phân rã công việc &amp; Sơ đồ Gantt · {shortDate(minStart)} → {shortDate(lastWorkDay)}
          {soVong > 1 && (
            <span className="text-[10px] font-black text-brand-warning normal-case">· Vòng {vongHienTai}/{soVong}</span>
          )}
        </span>
        {/* Hồ sơ đã sang vòng sau: bảng chỉ hiện vòng đang chạy cho gọn (chị Trâm chốt 18/08/2026),
            việc của vòng trước xem lại bằng nút này — không mất đi đâu. */}
        {soVong > 1 && (
          <button
            type="button"
            onClick={() => setHienVongTruoc(v => !v)}
            title={hienVongTruoc
              ? 'Chỉ hiện vòng đang chạy cho gọn'
              : `Xem lại ${soViecVongTruoc} việc của các vòng trước`}
            className="text-[10px] font-bold px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:border-brand-accent/50 transition-colors shrink-0"
          >
            {hienVongTruoc ? 'Chỉ vòng đang chạy' : `Xem vòng trước (${soViecVongTruoc})`}
          </button>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={() => {
              // Bấm là mở thanh thêm việc VÀ xổ luôn thư viện tên thường gặp (chị Trâm — góp ý #62)
              const mo = !showAdd;
              setShowAdd(mo);
              setMoThuVien(mo && thuVienTen.length > 0);
              if (!mo) setTimThuVien('');
            }}
            className="text-[10px] font-black bg-brand-accent/10 dark:bg-brand-accent/10 text-brand-accent dark:text-brand-accent-300 hover:bg-brand-accent/15 dark:hover:bg-brand-accent/20 px-2 py-1 rounded-lg flex items-center gap-1 transition-colors shrink-0"
          >
            <Plus className="w-3 h-3" /> Thêm việc con
          </button>
        )}
      </div>

      {canEdit && showAdd && (
        <div className="px-3 py-2 bg-brand-accent/5 dark:bg-brand-accent/15 border-b border-slate-100 dark:border-slate-800 space-y-2">
        {/* ===== THƯ VIỆN TÊN VIỆC CON (chị Trâm — góp ý #62, 18/08/2026) =====
            2 tên thường gặp nhất đặt sẵn thành nút bấm nhanh; bấm "Thư viện tên việc" để xổ hết
            danh sách (có ô gõ tìm). Chọn tên nào là tên đó nhảy vào ô bên dưới để SỬA TRỰC TIẾP,
            rồi mới bấm Thêm — đúng cách chị Trâm yêu cầu. */}
        {thuVienTen.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Thường dùng:
              </span>
              {thuVienTen.slice(0, 2).map(g => (
                <button
                  key={g.ten}
                  type="button"
                  onClick={() => { setNewName(g.ten); setMoThuVien(false); }}
                  title={`Đã dùng ${g.soLan} lần — bấm để đưa vào ô tên rồi sửa lại nếu cần`}
                  className="text-[10px] font-bold px-2 py-1 rounded-full border border-brand-accent/40 bg-brand-accent/10 text-brand-accent dark:text-brand-accent-300 hover:bg-brand-accent/20 transition-colors max-w-[240px] truncate"
                >
                  {g.ten} <span className="opacity-70">({g.soLan})</span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => setMoThuVien(v => !v)}
                className="text-[10px] font-black px-2 py-1 rounded-full border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:border-brand-accent/50 flex items-center gap-1 transition-colors"
              >
                <Library className="w-3 h-3" />
                Thư viện tên việc ({thuVienTen.length})
                <ChevronDown className={`w-3 h-3 transition-transform ${moThuVien ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {moThuVien && (
              <div className="border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-dark-bg p-1.5 space-y-1.5">
                <div className="relative">
                  <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={timThuVien}
                    onChange={(e) => setTimThuVien(e.target.value)}
                    placeholder="Gõ để tìm trong thư viện…"
                    className="w-full pl-6 pr-2 py-1 text-[11px] bg-white dark:bg-dark-elevated border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:ring-1 focus:ring-brand-accent focus:outline-none"
                  />
                </div>
                {(() => {
                  const tim = timThuVien.trim().toLowerCase();
                  const loc = tim ? thuVienTen.filter(g => g.ten.toLowerCase().includes(tim)) : thuVienTen;
                  if (loc.length === 0) {
                    return <p className="text-[10px] text-slate-400 italic px-1 py-1">Không có tên nào khớp — gõ tên mới vào ô bên dưới.</p>;
                  }
                  return (
                    <ul className="max-h-44 overflow-y-auto space-y-0.5">
                      {loc.map(g => (
                        <li key={g.ten}>
                          <button
                            type="button"
                            onClick={() => { setNewName(g.ten); setMoThuVien(false); setTimThuVien(''); }}
                            className="w-full text-left flex items-center justify-between gap-2 px-2 py-1 rounded text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-brand-accent/10 transition-colors"
                          >
                            <span className="truncate">{g.ten}</span>
                            <span className="text-[9px] text-slate-400 shrink-0">{g.soLan} lần</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addTask(); }}
            placeholder="Tên công việc con mới… (chọn từ thư viện rồi sửa lại được)"
            className="flex-1 min-w-0 px-2 py-1 text-[11px] bg-white dark:bg-dark-bg border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:ring-1 focus:ring-brand-accent focus:outline-none"
          />
          <input
            type="number" min={1} value={newWeight}
            onChange={(e) => setNewWeight(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-14 px-1 py-1 text-[11px] text-center bg-white dark:bg-dark-bg border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:ring-1 focus:ring-brand-accent focus:outline-none"
            title="Tỉ trọng %"
          />
          <button type="button" onClick={addTask} className="text-[10px] font-black bg-brand-primary hover:bg-brand-primary-hover text-white px-2.5 py-1 rounded-lg shrink-0">Thêm</button>
        </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="text-[11px] text-slate-400 italic p-4 text-center">Chưa có công việc con nào. {canEdit ? 'Bấm "Thêm việc con" để bắt đầu.' : ''}</div>
      ) : (
        /* Mobile: biểu đồ Gantt giữ dạng lưới, cuộn ngang trong khung riêng (ngoại lệ chart — như tab Gantt lớn) */
        <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] md:min-w-0 text-left text-[11px] table-fixed">
          <thead>
            <tr className="bg-slate-50 dark:bg-dark-elevated/50 text-slate-500 dark:text-slate-400 border-b border-slate-200/60 dark:border-slate-800 text-[9px] uppercase font-black">
              <th className="p-2 w-7"></th>
              <th className="p-2 w-[26%]">Công việc con</th>
              <th className="p-2 w-12 text-center">Tỉ trọng</th>
              <th className="p-2 w-[11%]">Người thực hiện</th>
              {/* Form nay dung het be rong (muc #88) nen con nhieu cho — noi cot Bat dau de ngay hien
                  du "18-08-2026" va nut lich co cho rieng (chi Tram bao 18/08/2026). */}
              <th className="p-2 w-36">Bắt đầu</th>
              <th className="p-2 w-20 text-center" title="Số ngày làm việc — bước nhảy nửa ngày (0,5); bấm ▲▼ để tăng/giảm">Ngày</th>
              <th className="p-2 w-14 text-center" title="Bộ phận thực hiện — chiếm 70% trọng số">BP 70%</th>
              {isBOOD && <th className="p-2 w-14 text-center" title="Trưởng phòng duyệt — chiếm 30% trọng số">TP 30%</th>}
              <th className="p-2">
                <div className="flex items-center justify-between gap-1 normal-case">
                  {/* Mốc ngày phải ĐỌC ĐƯỢC (chị Trâm báo 18/08/2026: chữ quá mờ) — tăng cỡ và
                      dùng màu chữ chính thay cho xám nhạt. */}
                  {axisTicks.map((t, i) => (
                    <span key={i} className="text-[10px] font-black text-slate-600 dark:text-slate-200 font-mono tracking-tight">{t}</span>
                  ))}
                </div>
              </th>
              {canEdit && <th className="p-2 w-8"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map(({ task, start, days, depth }) => {
              const assigneeId = task.assignedTo || (task.assignedStaffIds || [])[0] || '';
              const assignee = staff.find(s => s.id === assigneeId);
              const offsetDays = Math.round((start.getTime() - minStart.getTime()) / DAY_MS);
              const leftPct = (offsetDays / totalDays) * 100;
              const widthPct = Math.max(4, (days / totalDays) * 100);
              const progress = combinedProgress(task);
              const barColor = progress >= 100 ? 'bg-brand-success' : progress > 0 ? 'bg-brand-accent' : 'bg-slate-300 dark:bg-slate-700';
              // Việc thuộc vòng TRƯỚC: Quản lý chỉ xem (giữ nguyên số liệu vòng đã gửi CĐT), TP vẫn sửa được.
              const rowEdit = canEdit && !khoaViec(task);
              // Việc cấp 1 ĐÃ CHIA cho nhiều người: ngày bắt đầu và số ngày do app suy từ các phần
              // cấp 2 (một chiều — chị Trâm chốt 18/08/2026), nên khoá 2 ô đó lại. Cho gõ 2 chiều thì
              // sửa bên nào cũng đè bên kia, không bao giờ khớp.
              const daChiaChoNhieuNguoi = (task.subtasks || []).length > 0;
              const vongCuaDong = vongCua(task);
              return (
                <tr
                  key={task.id}
                  // id để bấm thông báo liên quan việc con này CUỘN THẲNG tới đây (xem
                  // viecConCanCuonToi trong App.tsx — Nguyễn Xuân Thi báo 24/08/2026).
                  id={`viec-con-${task.id}`}
                  className={`text-slate-600 dark:text-slate-300 align-middle ${vongCuaDong < vongHienTai ? 'bg-slate-50/60 dark:bg-dark-bg/40' : ''} ${depth > 0 ? 'bg-brand-accent/[0.03] dark:bg-brand-accent/[0.06]' : ''}`}
                >
                  <td className="p-2">
                    <button
                      type="button"
                      onClick={() => rowEdit && patch(task.id, { isCompleted: !task.isCompleted, staffProgress: !task.isCompleted ? 100 : 0, managerProgress: !task.isCompleted ? 100 : 0, completedAt: !task.isCompleted ? fmt(new Date()) : undefined })}
                      disabled={!rowEdit}
                      className="text-slate-400 hover:text-brand-accent disabled:cursor-default"
                      title={task.isCompleted ? 'Bỏ đánh dấu hoàn thành' : 'Đánh dấu hoàn thành'}
                    >
                      {task.isCompleted ? <CheckSquare className="w-4 h-4 text-brand-accent dark:text-brand-accent-300" /> : <Square className="w-4 h-4" />}
                    </button>
                  </td>
                  <td className="p-2">
                    <div className="flex items-center gap-0.5 min-w-0" style={depth > 0 ? { paddingLeft: 14 } : undefined}>
                    {/* Phần việc của một thành viên (đã chia từ việc cha — góp ý #7) */}
                    {depth > 0 && (
                      <span className="text-[9px] text-brand-accent dark:text-brand-accent-300 shrink-0" title="Phần việc của một thành viên, tách từ việc con phía trên">↳</span>
                    )}
                    {/* Việc của vòng trước có nhãn vòng để không lẫn với việc vòng đang làm */}
                    {soVong > 1 && (
                      <span className={`text-[8px] font-black px-1 py-0.5 rounded mr-1 ${
                        vongCuaDong === vongHienTai
                          ? 'bg-brand-accent/10 text-brand-accent dark:text-brand-accent-300'
                          : 'bg-slate-200/70 dark:bg-dark-elevated text-slate-500 dark:text-slate-400'
                      }`} title={vongCuaDong === vongHienTai ? `Việc của vòng ${vongCuaDong} (đang làm)` : `Việc của vòng ${vongCuaDong} — đã gửi CĐT${khoaViec(task) ? ', chỉ Trưởng phòng sửa được' : ''}`}>
                        V{vongCuaDong}
                      </span>
                    )}
                    {/* TÊN DÀI PHẢI TỰ XUỐNG DÒNG, KHÔNG ĐƯỢC MẤT CHỮ (chị Trâm báo 18/08/2026:
                        "cho xuống dòng chứ đừng mất chữ", nhắc lại chiều 18/08: "tên công việc con
                        dài chưa tự động xuống dòng nè e").
                        Lần đầu chỉ sửa cho chế độ XEM nên lúc ĐANG SỬA vẫn là <input> một dòng —
                        thẻ input không bao giờ xuống dòng được, tên dài là bị cắt. Nay ô sửa dùng
                        AutoGrowTextarea: chữ tự xuống dòng và ô tự cao thêm. Enter = xong (rời ô),
                        không thêm dòng mới, vì đây là TÊN việc chứ không phải đoạn văn. */}
                    {rowEdit ? (
                      <AutoGrowTextarea
                        minRows={1}
                        value={task.name}
                        onChange={(e) => patch(task.id, { name: e.target.value })}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
                        className={`w-full min-w-0 bg-transparent px-1 py-0.5 text-[11px] font-bold leading-snug rounded focus:bg-slate-50 dark:focus:bg-dark-elevated focus:outline-none ${task.isCompleted ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-200'}`}
                        title={task.name}
                      />
                    ) : (
                      <span
                        className={`w-full min-w-0 px-1 py-0.5 text-[11px] font-bold leading-snug whitespace-normal break-words ${task.isCompleted ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-200'}`}
                        title={task.name}
                      >
                        {task.name}
                      </span>
                    )}
                    </div>
                  </td>
                  <td className="p-2 text-center">
                    <input
                      type="number" min={0} max={100} value={task.weight}
                      disabled={!rowEdit}
                      onChange={(e) => patch(task.id, { weight: parseInt(e.target.value) || 0 })}
                      className="w-11 px-1 py-1 text-[10px] font-black text-center bg-slate-50 dark:bg-dark-bg border border-slate-200 dark:border-slate-700 rounded text-slate-700 dark:text-slate-200 disabled:opacity-70 focus:ring-1 focus:ring-brand-accent focus:outline-none"
                    />
                  </td>
                  {/* ===== NGƯỜI GIAO — BẤM CHỌN NHIỀU NGƯỜI (chị Trâm chốt 17/08/2026) =====
                      Bỏ nút 👥 và bảng chọn riêng: bấm thẳng vào ô là xổ danh sách, bấm tên nào là
                      chọn tên đó, bấm lại là bỏ chọn. Chọn từ 2 người trở lên thì app TỰ tách việc
                      thành các phần con, tỉ trọng chia đều — không phải bấm thêm nút nào nữa
                      (trước đây tick xong mà quên bấm "Chia đều" là lưu ra không có gì). */}
                  <td className="p-2 relative">
                    {(() => {
                      const dangChon = nguoiCuaViec(task);
                      const tenChon = dangChon.map(id => staff.find(x => x.id === id)?.hoTen).filter(Boolean) as string[];
                      const nhan = tenChon.length === 0 ? 'Chưa gán'
                        : tenChon.length === 1 ? tenHoVaTen(tenChon[0])
                          : `${tenChon.length} người`;
                      return (
                        <div className="flex items-center gap-1 min-w-0">
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center text-[7px] font-black uppercase shrink-0 ${getInitialsColor(tenChon[0] || '')}`}>
                            {tenChon.length > 1 ? '2+' : getInitials(tenChon[0] || '?')}
                          </div>
                          {rowEdit ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                const dangMo = chiaViecId === task.id;
                                setONeoChon(dangMo ? null : e.currentTarget);   // neo vào ĐÚNG nút vừa bấm
                                setChiaViecId(dangMo ? null : task.id);
                              }}
                              title={tenChon.length > 1 ? `Cùng làm: ${tenChon.join(' · ')}` : 'Bấm để chọn người làm (chọn được nhiều người)'}
                              className="flex-1 min-w-0 text-left text-[10px] font-bold bg-slate-50 dark:bg-dark-bg border border-slate-200 dark:border-slate-700 rounded px-1 py-1 text-slate-700 dark:text-slate-200 hover:border-brand-accent/60 truncate"
                            >
                              {nhan} <span className="text-slate-400">▾</span>
                            </button>
                          ) : (
                            <span className="text-[9px] font-bold truncate" title={tenChon.join(' · ')}>
                              {tenChon.length > 1 ? `👥 ${tenChon.length} người` : (tenChon[0] ? tenHoVaTen(tenChon[0]) : 'Chưa gán')}
                            </span>
                          )}
                        </div>
                      );
                    })()}

                    {/* Danh sách người: bấm tên = chọn, bấm lại = bỏ chọn. Chọn xong tự áp dụng ngay.
                        ĐƯA RA <body> BẰNG PORTAL + position: fixed — nằm trong ô bảng thì bị
                        overflow của bảng cắt mất (chị Trâm báo 18/08/2026). Xem tinhViTriChon. */}
                    {chiaViecId === task.id && rowEdit && viTriChon && typeof document !== 'undefined' && createPortal(
                      <div
                        data-danh-sach-nguoi
                        className="fixed z-[70] w-52 max-h-72 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-dark-card shadow-2xl p-1.5"
                        style={{ top: viTriChon.top, left: viTriChon.left, width: RONG_CHON }}
                      >
                        {/* Tiêu đề + nút đóng đặt ở ĐẦU danh sách: nút cũ nằm cuối danh sách 9 người nên
                            phải cuộn xuống mới thấy (chị Trâm báo 18/08/2026). Tick tên là chia ngay,
                            nên nút này chỉ để đóng cho gọn — bấm ra ngoài cũng đóng. */}
                        <div className="flex items-center justify-between gap-2 px-2 py-1 mb-0.5 border-b border-slate-100 dark:border-slate-800">
                          <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Chọn người thực hiện
                          </span>
                          <button
                            type="button"
                            onClick={() => { setChiaViecId(null); setONeoChon(null); }}
                            title="Đóng danh sách (tick tên là đã chia ngay)"
                            className="text-[11px] font-black text-slate-400 hover:text-brand-danger leading-none px-1"
                          >
                            ✕
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => { datNguoiLam(task, []); setChiaViecId(null); setONeoChon(null); }}
                          className="w-full text-left text-[10px] font-bold px-2 py-1 rounded text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-dark-elevated"
                        >
                          Chưa gán
                        </button>
                        {activeStaff.map(s => {
                          const dsTick = nguoiCuaViec(task);
                          const daChon = dsTick.includes(s.id);
                          return (
                            <button
                              key={s.id}
                              type="button"
                              /* Áp dụng NGAY: bấm tên là chia lại phần cấp 2 luôn, không cần bấm Xong */
                              onClick={() => datNguoiLam(task, daChon
                                ? dsTick.filter(x => x !== s.id)
                                : [...dsTick, s.id])}
                              className={`w-full flex items-center gap-1.5 text-left text-[10px] font-bold px-2 py-1 rounded transition-colors ${
                                daChon
                                  ? 'bg-brand-accent/10 text-brand-accent dark:text-brand-accent-300'
                                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-dark-elevated'
                              }`}
                            >
                              <span className="w-3 shrink-0">{daChon ? '✓' : ''}</span>
                              <span className="truncate">{s.hoTen}</span>
                            </button>
                          );
                        })}
                        <div className="border-t border-slate-100 dark:border-slate-800 mt-1 pt-1 px-2 pb-0.5">
                          <span className="text-[9px] text-slate-400 dark:text-slate-500 block">
                            {(() => {
                              const n = nguoiCuaViec(task).length;
                              const goc = Math.max(0, task.weight || 0);
                              return n >= 2
                                ? `Đã chia ${goc}% của việc này thành ${n} phần ≈ ${Math.floor(goc / n)}% mỗi người — sửa lại tỉ trọng từng phần được.`
                                : 'Bấm thêm một tên nữa là app tự chia đều việc ngay.';
                            })()}
                          </span>
                        </div>
                      </div>,
                      document.body
                    )}
                  </td>
                  <td className="p-2">
                    <DateInput
                      value={daChiaChoNhieuNguoi || parseDate(task.ngayBatDau) ? fmt(start) : ''}
                      disabled={!rowEdit || daChiaChoNhieuNguoi}
                      title={daChiaChoNhieuNguoi ? 'Tự tính = ngày bắt đầu SỚM NHẤT của các phần đã chia cho từng người' : undefined}
                      onChange={(v) => patch(task.id, { ngayBatDau: v })}
                      className="w-full px-1.5 py-1 text-[10px] font-semibold bg-slate-50 dark:bg-dark-bg border border-slate-200 dark:border-slate-700 rounded text-slate-700 dark:text-slate-200 disabled:opacity-70 focus:ring-1 focus:ring-brand-accent focus:outline-none"
                    />
                  </td>
                  <td className="p-2 text-center">
                    {/* NỬA NGÀY LÀ ĐƠN VỊ NHỎ NHẤT (chị Trâm chốt 17/08/2026): nhập 3 hoặc 3,5.
                        Xem ghi chú ở ONhapSoNgay — chỉ chuẩn hoá khi rời ô, không làm tròn từng ký tự. */}
                    <ONhapSoNgay
                      giaTri={days}
                      disabled={!rowEdit || daChiaChoNhieuNguoi}
                      ghiChu={daChiaChoNhieuNguoi
                        ? 'Tự tính = ngày kết thúc MUỘN NHẤT của các phần đã chia, trừ ngày bắt đầu sớm nhất'
                        : undefined}
                      onChot={(n) => patch(task.id, { soNgay: n })}
                    />
                  </td>
                  <td className="p-2 text-center">
                    <span className="text-[10px] font-black text-brand-accent dark:text-brand-accent-300">{task.staffProgress ?? (task.isCompleted ? 100 : 0)}%</span>
                  </td>
                  {isBOOD && (
                    <td className="p-2 text-center">
                      <input
                        type="number" min={0} max={100} value={task.managerProgress ?? (task.isCompleted ? 100 : 0)}
                        onChange={(e) => patch(task.id, { managerProgress: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) })}
                        className="w-11 px-1 py-1 text-[10px] font-black text-center bg-brand-warning/10 dark:bg-brand-warning/10 border border-brand-warning/25 dark:border-brand-warning/40 rounded text-brand-warning dark:text-brand-warning focus:ring-1 focus:ring-brand-warning focus:outline-none"
                        title="Trưởng phòng duyệt (30% trọng số)"
                      />
                    </td>
                  )}
                  <td className="p-2">
                    <div className="relative h-5 bg-slate-100/70 dark:bg-dark-elevated/40 rounded-md overflow-hidden">
                      <div
                        className={`absolute top-0.5 bottom-0.5 ${barColor} rounded shadow-sm flex items-center justify-between px-1`}
                        style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                        title={`${String(start.getDate()).padStart(2, '0')}-${String(start.getMonth() + 1).padStart(2, '0')}-${start.getFullYear()} · ${soNgayGon(days)} ngày · ${progress}%`}
                      >
                        <span className="text-[8px] font-black text-white/90 truncate">{widthPct >= 18 ? `${shortDate(start)} · ${soNgayGon(days)}d` : `${soNgayGon(days)}d`}</span>
                        <span className="text-[8px] font-black text-white/90 truncate">{progress}%</span>
                      </div>
                    </div>
                  </td>
                  {rowEdit && (
                    <td className="p-2 text-center">
                      <button type="button" onClick={() => remove(task.id)} className="text-slate-300 hover:text-brand-danger transition-colors" title="Xóa việc con">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      )}

      {!hideFooter && (
      <div className="px-3 py-1.5 bg-slate-50/60 dark:bg-dark-bg/40 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[9px] text-slate-400 font-medium">
          Tiến độ mỗi việc = Bộ phận thực hiện <b className="text-brand-accent">70%</b> + Trưởng phòng duyệt <b className="text-brand-warning">30%</b> (mặc định). Việc chưa đặt ngày tự xếp nối tiếp từ mốc bắt đầu dự án.
        </span>
        {rows.length > 0 && (
          <span className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
              totalWeight === 100
                ? 'bg-brand-primary/10 text-brand-primary dark:bg-brand-primary/10 dark:text-brand-primary-300'
                : 'bg-brand-danger/10 text-brand-danger dark:bg-brand-danger/10 dark:text-brand-danger'
            }`} title={totalWeight === 100 ? 'Tỉ trọng đã đủ 100%' : 'Tổng tỉ trọng việc con của vòng này phải đủ 100% mới lưu được hồ sơ'}>
              Σ Tỉ trọng{soVong > 1 ? ` vòng ${vongHienTai}` : ''}: {totalWeight}%
              {totalWeight === 100 ? ' ✓' : totalWeight < 100 ? ` — thiếu ${100 - totalWeight}%` : ` — vượt ${totalWeight - 100}%`}
            </span>
            {/* Tự chia % đóng góp: giữ nguyên việc Quản lý đã gõ, chia đều phần thiếu cho việc để trống */}
            {canEdit && totalWeight !== 100 && (
              <button
                type="button"
                onClick={chiaDeuTiTrong}
                className="text-[10px] font-black px-2 py-0.5 rounded-full bg-brand-accent/10 text-brand-accent dark:text-brand-accent-300 border border-brand-accent/30 hover:bg-brand-accent/20 transition-colors cursor-pointer whitespace-nowrap"
                title="Chia đều phần % còn thiếu cho các việc chưa đặt tỉ trọng (việc đã đặt giữ nguyên)"
              >
                ⚖ Tự chia đủ 100%
              </button>
            )}
            {/* Lũy kế mọi vòng: 2 lần báo giá đủ chuẩn = 200% */}
            {soVong > 1 && (
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-brand-warning/10 text-brand-warning" title={`Hồ sơ đã qua ${soVong} vòng — mỗi vòng 100%`}>
                Lũy kế {soVong} vòng: {luyKeWeight}/{soVong * 100}%
              </span>
            )}
          </span>
        )}
      </div>
      )}
    </div>
  );
}
