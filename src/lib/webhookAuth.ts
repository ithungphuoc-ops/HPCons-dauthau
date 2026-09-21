import "server-only";
import { NextRequest } from "next/server";
import { createHash, timingSafeEqual } from "crypto";

/**
 * XÁC THỰC WEBHOOK NỘI BỘ (IT yêu cầu 15/09/2026 — "làm sẵn code để nối webhook vào đó")
 *
 * Dùng chung cho mọi cửa nhận dữ liệu do app khác ĐẨY sang. Nguyên tắc:
 *
 *  1. CHƯA khai secret thì TỪ CHỐI (503), không phải "cho qua". Một webhook mở toang trong lúc
 *     chờ cấu hình là chỗ để người ngoài ghi đè danh mục dự án của công ty.
 *  2. So sánh bằng timingSafeEqual trên bản băm SHA-256 — băm trước để hai chuỗi luôn cùng độ dài
 *     (timingSafeEqual ném lỗi nếu khác độ dài, mà chính việc ném lỗi đã làm lộ độ dài secret).
 *  3. Nhận secret ở `Authorization: Bearer <secret>` hoặc `X-Webhook-Secret` — app bên kia dùng
 *     kiểu nào cũng được, đỡ phải sửa code của họ.
 */

// CỐ Ý không dùng union phân biệt ({ok:true} | {ok:false,...}): tsconfig của dự án để
// strict:false nên TypeScript không thu hẹp kiểu theo `ok`, viết union sẽ báo lỗi giả.
export type KetQuaXacThuc = { ok: boolean; status?: 401 | 503; loi?: string };

const bangNhau = (a: string, b: string): boolean => {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
};

/** Lấy secret người gọi gửi lên, ưu tiên Bearer. */
const secretGuiLen = (req: NextRequest): string => {
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (m) return m[1].trim();
  return (req.headers.get("x-webhook-secret") || "").trim();
};

/**
 * @param tenBien tên biến môi trường chứa secret, ví dụ "THIET_KE_WEBHOOK_SECRET".
 */
export const xacThucWebhook = (req: NextRequest, tenBien: string): KetQuaXacThuc => {
  const mong = process.env[tenBien];
  if (!mong) {
    return {
      ok: false,
      status: 503,
      loi: `Chưa cấu hình ${tenBien} phía app đấu thầu. Webhook tạm khoá cho tới khi IT khai biến này.`,
    };
  }
  const nhan = secretGuiLen(req);
  if (!nhan || !bangNhau(nhan, mong)) {
    return { ok: false, status: 401, loi: "Sai hoặc thiếu secret webhook." };
  }
  return { ok: true };
};
