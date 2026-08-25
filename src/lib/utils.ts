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
