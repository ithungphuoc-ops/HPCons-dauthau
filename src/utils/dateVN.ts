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
