/**
 * GỌI ĐỒNG BỘ DỰ ÁN SANG APP THIẾT KẾ — phía trình duyệt (OpenSpec `lien-ket-thiet-ke-dau-thau`).
 *
 * Trình duyệt KHÔNG gửi danh sách dự án: chỉ "gõ cửa" route máy chủ, route tự đọc `projects`
 * bằng Admin SDK, tự ký HMAC và tự gửi (secret không bao giờ xuống trình duyệt). Xác thực dựa trên
 * cookie phiên App Tổng mà fetch cùng tên miền tự đính kèm — giống mọi lệnh fetch khác của app.
 */

export type TongKetDongBoThietKe = {
  ok: boolean;
  chuaCauHinh?: boolean;
  thongBao?: string;
  daGui?: number;
  khongDoi?: number;
  boQua?: number;
  /** Số dự án gửi lỗi (khi ok) — hoặc câu lỗi (khi route lỗi 500). */
  loi?: number | string;
  chiTietLoi?: Array<{ projectCode: string; loi: string }>;
  error?: string;
};

export async function goiDongBoThietKe(): Promise<TongKetDongBoThietKe> {
  const res = await fetch('/api/lien-ket/thiet-ke/dong-bo', { method: 'POST', cache: 'no-store' });
  const data = (await res.json().catch(() => ({}))) as TongKetDongBoThietKe;
  if (!res.ok) {
    throw new Error(
      (typeof data?.loi === 'string' && data.loi) || data?.error || `Máy chủ trả lỗi ${res.status}`,
    );
  }
  return data;
}
