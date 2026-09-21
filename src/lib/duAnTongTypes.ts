/**
 * KIỂU DỮ LIỆU DANH MỤC DỰ ÁN — dùng chung cho CẢ hai phía.
 *
 * CỐ Ý tách khỏi src/lib/duAnTong.ts: file đó có `import "server-only"` nên component React không
 * import được. Tách ra đây để giao diện và webhook cùng nhìn MỘT định nghĩa, tránh cảnh hai bên
 * khai hai kiểu rồi lệch nhau lúc nào không hay (cùng cách đã làm với tiến độ thiết kế).
 */

/**
 * MỘT DỰ ÁN ĐỌC TỪ APP THÔNG TIN DỰ ÁN.
 *
 * Bộ trường bám đúng các ô thông tin chung của hồ sơ thầu bên app này (xem `Project` trong
 * src/types.ts), để đổ sang là điền thẳng được, không phải gõ lại (chị Trâm chốt 19/09/2026:
 * "tất cả các thông tin gói thầu được khởi tạo ở app đó đều về app mình nhé em").
 *
 * Trường nào App Thông tin dự án chưa có thì cứ bỏ trống — bảng tự để trống ô đó, không vỡ.
 */
export type DuAnTong = {
  maDuAn: string;
  tenDuAn: string;
  chuDauTu?: string;
  diaChi?: string;
  quocTich?: string;
  khuCongNghiep?: string;
  tinhThanh?: string;
  loaiCongTrinh?: string;
  hinhThucXayDung?: string;
  giaiDoanDuAn?: string;
  hoSoPhatThau?: string;
  dienTichDat?: number;
  /** Tình trạng dự án bên app kia (Đang triển khai / Tạm dừng / Đã đóng...). */
  tinhTrangDuAn?: string;
  /** Ngày khởi tạo hồ sơ bên App Thông tin dự án — yyyy-mm-dd. */
  ngayKhoiTao?: string;
  /** Người khởi tạo / phụ trách bên app kia. */
  nguoiTao?: string;
  tienDoThietKe?: number;
  giaiDoanThietKe?: string;
  capNhatLuc?: string; // ISO — bên này đóng dấu lúc nhận
};
