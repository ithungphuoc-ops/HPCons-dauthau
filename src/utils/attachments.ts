// Nhiều tệp đính kèm được lưu trong CÙNG trường taiLieuDinhKem (string) — nối bằng " | ".
// Giữ nguyên kiểu dữ liệu string cũ: 1 tệp = không có dấu phân tách, dữ liệu cũ vẫn đọc bình thường.
export const ATTACH_SEP = ' | ';

/** Tách chuỗi taiLieuDinhKem thành danh sách tên tệp (bỏ khoảng trắng thừa, loại rỗng). */
export const parseAttachments = (raw?: string): string[] =>
  (raw || '').split(ATTACH_SEP).map((s) => s.trim()).filter(Boolean);

/** Gộp danh sách tên tệp về chuỗi lưu trữ; rỗng → undefined để không ghi trường thừa. */
export const joinAttachments = (names: string[]): string | undefined =>
  names.length ? names.join(ATTACH_SEP) : undefined;
