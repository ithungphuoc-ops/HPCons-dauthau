import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * cn() — gộp className (clsx) + hợp nhất xung đột Tailwind (tailwind-merge).
 * Tiện ích nền của thư viện component dùng chung HPCons (theo mẫu shadcn/ui).
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * maHienThi() — chuẩn hóa Mã Project_ID về CHỮ HOA khi HIỂN THỊ (chỉ trình bày, không đổi
 * dữ liệu thật). Một số hồ sơ cũ lỡ lưu chữ thường (chị Trâm báo 25/08/2026: "Mã dự án viết
 * hoa hết, nhưng hiển thị lúc hoa lúc thường") — sửa ở ĐÂY thay vì chuẩn hóa ngay trong state
 * `projects`, vì state đó chính là thứ được so sánh (diff) rồi đẩy lên Firestore mỗi lần lưu
 * (xem pushCollection/ghiMotLuot trong lib/firebase.ts); đổi giá trị trong state sẽ khiến lần
 * lưu KHÔNG LIÊN QUAN tiếp theo ghi đè ngoài ý muốn lên mọi hồ sơ cũ khác chỉ vì lệch hoa/thường
 * (phát hiện lúc code review nội bộ PR#2).
 */
export function maHienThi(projectId?: string | null): string {
  return (projectId || '').trim().toUpperCase();
}

/**
 * maHoSo() — MÃ ĐẦY ĐỦ của một hồ sơ để hiển thị, ghép cả hai ô mã (chị Trâm chốt 12/09/2026):
 *   Ô 1 `projectId` (mã từ App Thông tin dự án, dạng xxxxxx-HPCS) + Ô 2 `maNoiBo` (mã Phòng tự đặt)
 *   → "260034-HPCS-BG-COL"
 * Hồ sơ chưa khai ô 2 thì trả về đúng ô 1, nên dữ liệu cũ đọc lên không đổi.
 *
 * DÙNG HÀM NÀY Ở MỌI NƠI HIỂN THỊ MÃ (Dashboard, Kanban, Gantt, danh sách, thông báo, nhật ký,
 * xuất Excel). Đừng nối chuỗi tay ở từng màn hình — đó chính là cách hai màn hình bắt đầu hiện
 * hai kiểu mã khác nhau.
 */
export function maHoSo(p?: { projectId?: string | null; maNoiBo?: string | null } | null): string {
  const o1 = maHienThi(p?.projectId);
  const o2 = maHienThi(p?.maNoiBo);
  if (!o2) return o1;
  if (!o1) return o2;
  return `${o1}-${o2}`;
}

/**
 * ĐỊNH DẠNG SỐ THEO QUY ĐỊNH CÔNG TY (thông báo nội bộ 19/08/2026)
 *
 * "Định dạng số => định dạng cách số ngàn triệu ',', định dạng thập phân '.'
 *  => 123,000,000 đ, hoặc 15,065.234"
 *
 * ⚠ CỐ Ý KHÔNG dùng toLocaleString('vi-VN'): locale Việt Nam cho ra "123.000.000" và "15065,234" —
 * ngược hẳn quy định. Ghim cứng 'en-US' để mọi máy, mọi trình duyệt đều ra một kiểu; dùng locale
 * theo máy người dùng thì cùng một hồ sơ mở ở hai máy sẽ hiện hai kiểu số khác nhau.
 *
 * Câu hỏi của Phòng ("định dạng mỗi app mỗi khác thì có bị lỗi xung đột hay không"): KHÔNG xung đột
 * về dữ liệu — số lưu trong Firestore là kiểu số, không phải chuỗi, nên định dạng chỉ là chuyện
 * HIỂN THỊ. Chỉ sai khi đọc/ghi qua file Excel hoặc API dạng chuỗi; lúc đó phải thống nhất đúng
 * quy định này.
 */
export function dinhDangSo(n?: number | null, soLeToiDa = 3): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '';
  return n.toLocaleString('en-US', { maximumFractionDigits: soLeToiDa });
}

/** Số tiền theo quy định công ty: "123,000,000 đ". */
export function dinhDangTien(n?: number | null): string {
  const s = dinhDangSo(n, 0);
  return s ? `${s} đ` : '';
}

/**
 * NHÃN HỒ SƠ ĐẦY ĐỦ — "mã | tên", theo quy định nối trường của công ty (thông báo nội bộ 19/08/2026)
 *
 * "Định dạng nối trường: 260001-HPCS-HDXD-001 | CÔNG TRÌNH CHIEN YI"
 *
 * Dấu "|" ngăn MÃ với TÊN. Bên trong phần mã thì vẫn là dấu "-" (xem maHoSo) — đúng như ví dụ của
 * công ty, mã gồm nhiều đoạn nối bằng "-".
 *
 * Trước đây mỗi chỗ tự nối `${maHoSo(p)} - ${p.tenDuAn}`, vừa sai quy định vừa khó đọc: tên dự án
 * có sẵn dấu "-" nên nhìn vào không biết mã hết ở đâu, tên bắt đầu từ đâu.
 *
 * DÙNG HÀM NÀY Ở MỌI NƠI HIỂN THỊ "mã + tên" (nhật ký, thông báo, xuất Excel, tiêu đề).
 */
export function nhanHoSo(
  p?: { projectId?: string | null; maNoiBo?: string | null; tenDuAn?: string | null } | null,
): string {
  const ma = maHoSo(p);
  const ten = (p?.tenDuAn || '').trim();
  if (!ma) return ten;
  if (!ten) return ma;
  return `${ma} | ${ten}`;
}
