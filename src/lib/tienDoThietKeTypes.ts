/**
 * KIỂU DỮ LIỆU TIẾN ĐỘ THIẾT KẾ — dùng chung cho CẢ hai phía.
 *
 * CỐ Ý tách khỏi src/lib/tienDoThietKe.ts: file đó có `import "server-only"` nên component React
 * không import được. Tách ra đây để giao diện và webhook cùng nhìn MỘT định nghĩa, tránh cảnh hai
 * bên khai hai kiểu rồi lệch nhau lúc nào không hay.
 */

/** Một hạng mục thiết kế — dòng con nằm dưới dự án cha, đúng bảng báo cáo bên App Thiết kế. */
export type HangMucThietKe = {
  id: string;
  ten: string;
  loaiDuAn?: string;
  tinhTrang?: string;
  ngayLap?: string;        // yyyy-mm-dd
  ngayHoanThanh?: string;  // yyyy-mm-dd
  soTask?: number;
  soTaskXong?: number;
  nguoiThucHien?: string;
  treHan?: number;         // số ngày trễ; 0 hoặc bỏ trống = đúng hạn
};

/** Một dự án thiết kế — dòng cha, gom các hạng mục bên trong. */
export type DuAnThietKe = {
  maDuAn: string;
  tenDuAn: string;
  namTaiChinh?: string;    // ví dụ "2026-2027"
  loaiDuAn?: string;
  tinhTrang?: string;
  ngayLap?: string;
  ngayHoanThanh?: string;
  soTask?: number;
  nguoiThucHien?: string;
  treHan?: number;
  hangMuc: HangMucThietKe[];
  capNhatLuc?: string;     // ISO — bên này đóng dấu lúc nhận, không lấy của app kia
};
