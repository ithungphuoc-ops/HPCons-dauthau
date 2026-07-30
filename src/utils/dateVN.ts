// Định dạng ngày giờ kiểu Việt Nam cho MỌI chỗ HIỂN THỊ trong app.
// Dữ liệu LƯU TRỮ vẫn giữ nguyên ISO YYYY-MM-DD — tuyệt đối không dùng các hàm này khi ghi dữ liệu.

const pad = (n: number) => String(n).padStart(2, '0');

/** "2026-07-10" | Date → "10-07-2026". Chuỗi rỗng/không hợp lệ → trả về nguyên văn (hoặc ''). */
export const fmtDateVN = (d?: string | Date | null): string => {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return typeof d === 'string' ? d : '';
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;
};

/** ISO datetime | "YYYY-MM-DD HH:mm:ss" | Date → "10-07-2026 14:30". */
export const fmtDateTimeVN = (d?: string | Date | null): string => {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return typeof d === 'string' ? d : '';
  return `${fmtDateVN(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

// ===== SỐ NGÀY ĐÃ DỜI HẠN (chị Trâm báo lỗi cộng trùng 29/07/2026) =====
// Đọc từ CẶP hạn cũ → hạn mới của mỗi lần dời, KHÔNG cộng trường `soNgayLech`.
// Lý do: `soNgayLech` chỉ mang phần ngày CHƯA nằm trong kế hoạch việc con (log dời phát sinh từ
// việc con để 0 để hạn khỏi bị cộng hai lần) — nên nó KHÔNG phải số ngày đã dời thực tế.
// Muốn biết hồ sơ đã dời tổng cộng bao nhiêu ngày để báo cáo thì dùng hàm này.
const MOT_NGAY = 24 * 60 * 60 * 1000;

/** Số ngày dời thực tế của MỘT lần dời hạn (hạn cũ → hạn mới). */
export const soNgayDoiCuaLog = (log: { ngayCu: string; ngayMoi: string }): number => {
  const cu = new Date(log.ngayCu).getTime();
  const moi = new Date(log.ngayMoi).getTime();
  if (isNaN(cu) || isNaN(moi)) return 0;
  return Math.max(0, Math.round((moi - cu) / MOT_NGAY));
};

/** Tổng số ngày hồ sơ đã bị dời hạn qua mọi lần. */
export const tongNgayDoiHan = (logs?: { ngayCu: string; ngayMoi: string }[]): number =>
  (logs || []).reduce((s, l) => s + soNgayDoiCuaLog(l), 0);
