/**
 * LUẬT MÃ PHÒNG ĐẤU THẦU (Sếp chốt 26/09/2026 — OpenSpec change `lien-ket-thiet-ke-dau-thau`)
 *
 * Mã ô 1 (`projectId`) là mã GÕ TAY, có nhiều kiểu cùng tồn tại: `261008-HPCS`, `260039-HPCS`,
 * `2026.01`... Chỉ mã dạng `YY10xx-HPCS` mới là dự án của Phòng Đấu thầu:
 *   YY = 2 số năm (26, 27... — không cứng năm nào, sang 2027 không phải sửa code)
 *   10 = mã phòng Đấu thầu
 *   xx = 2 ký tự số hoặc chữ
 *   được phép có đuôi sau `-HPCS` (vd `261008-HPCS-BG-JYL`)
 *
 * ⚠ BIỂU THỨC NÀY PHẢI GIỐNG HỆT bên App Thiết kế (change cùng tên ở repo HPCons-Design) — đó là
 * "hợp đồng dữ liệu chung" trong design.md. Sửa một bên mà quên bên kia thì một bên gửi, bên kia
 * từ chối (400), dữ liệu kẹt giữa đường mà không ai thấy.
 *
 * CỐ Ý KHÔNG có `import "server-only"` và KHÔNG import `chuanHoaMa` từ chuanHoaChu.ts (file đó có
 * "server-only"): hàm thuần này cần dùng được ở cả máy chủ, giao diện, và script kiểm chạy bằng
 * Node trần. Phép chuẩn hoá ở đây y hệt `chuanHoaMa` (bỏ mọi khoảng trắng + viết HOA), chỉ khác là
 * trả chuỗi rỗng thay vì undefined cho gọn khi so khớp.
 */

const LUAT_MA_PHONG_DAU_THAU = /^\d{2}10[A-Z0-9]{2}-HPCS(-.*)?$/;

/** Bỏ MỌI khoảng trắng (kể cả giữa chuỗi) và viết HOA. Không phải chuỗi → "". */
export const chuanHoaMaDuAn = (v?: unknown): string => {
  if (typeof v !== 'string') return '';
  return v.replace(/\s+/g, '').toUpperCase();
};

/** Mã (thô hoặc đã chuẩn hoá) có phải mã dự án Phòng Đấu thầu không. */
export const laMaPhongDauThau = (v?: unknown): boolean =>
  LUAT_MA_PHONG_DAU_THAU.test(chuanHoaMaDuAn(v));
