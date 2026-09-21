import { ProjectTask } from '../types';

/**
 * KẾ HOẠCH VIỆC CON — MỘT NGUỒN DUY NHẤT TÍNH MỐC KẾT THÚC CỦA BỘ PHẬN
 *
 * ⚠ VÌ SAO TÁCH RA ĐÂY (chị Trâm báo 15/09/2026: "tại sao không bao giờ khớp em nhỉ")
 *
 * App đang có HAI bộ máy tính "kế hoạch việc con kết thúc ngày nào", cho ra hai kết quả khác nhau:
 *   · `khoangKeHoachViecCon` (vốn nằm trong SubtaskGantt) — xét cả phần cấp 2, có luật nửa ngày.
 *     Form hồ sơ lấy số này ra ô "Bộ phận thực hiện (ngày) · TỰ TÍNH TỪ KẾ HOẠCH".
 *   · `getExecEnd` (bên App.tsx) — chỉ duyệt việc cấp 1, không có luật nửa ngày. Dashboard, Kanban,
 *     Gantt và ô "Hạn hiện tại" lấy số này.
 *
 * Cùng một kế hoạch mà hai bên lệch nhau một ngày, nên "Hạn hoàn thành Phòng (tự tính)" và "Hạn
 * hiện tại (đã bù lệch)" không bao giờ trừ ra đúng bằng tổng số ngày đã xin gia hạn — đúng hiện
 * tượng chị Trâm gặp.
 *
 * Nay gom về đây, KHÔNG phụ thuộc React, để cả App.tsx lẫn SubtaskGantt cùng import. Tách thành
 * module riêng (không để App.tsx import thẳng từ SubtaskGantt) vì SubtaskGantt đã import ngược lại
 * App.tsx — để nguyên sẽ thành vòng tròn import.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;
// Số ngày mặc định cho việc con chưa nhập — dùng CHUNG với planRange bên ProjectForm để không lệch nhau
export const DEFAULT_TASK_DAYS = 3;
export const parseDate = (s?: string): Date | null => {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};
export const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY_MS);
export const shortDate = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;

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
export const mocTuNgay = (batDau: Date, soNgay: number) => {
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
