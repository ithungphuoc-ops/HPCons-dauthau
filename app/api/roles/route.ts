import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/src/lib/apiRateLimit";

// Danh sách vai trò CỦA CHÍNH app đấu thầu — App Tổng (account.hpcore.vn) gọi
// endpoint này để dựng dropdown gán quyền tại trang "Quản lý ứng dụng", không
// hard-code danh sách vai trò ở phía App Tổng. Public, CORS mở cho *.hpcore.vn.
const ROLES = {
  BOOD: "Ban Giám đốc / Trưởng phòng (Level 1)",
  MANAGER: "Quản lý (Level 2)",
  STAFF: "Chuyên viên (Level 3)",
  // Level 4 — Khách (chị Trâm chốt 26/07/2026): CHỈ XEM, không thêm/sửa/xóa gì.
  // Chỉ thấy 4 mục: Liên kết phòng ban · Dashboard · Báo cáo tiến độ · Bảng Kanban.
  VIEWER: "Khách — chỉ xem (Level 4)",
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": "public, max-age=300",
};

export async function GET(req: NextRequest) {
  // Endpoint public không cần đăng nhập (CORS mở *) — vẫn giới hạn nhẹ để chặn spam,
  // hào phóng vì Cache-Control: public, max-age=300 đã tự giảm phần lớn lượt gọi lặp lại.
  try {
    const result = await checkRateLimit("roles", getClientIp(req), { windowSeconds: 60, maxRequests: 30 });
    if (!result.allowed) {
      return NextResponse.json(
        { error: "Quá nhiều yêu cầu, vui lòng thử lại sau." },
        { status: 429, headers: { ...CORS, ...(result.retryAfterSeconds ? { "Retry-After": String(result.retryAfterSeconds) } : {}) } },
      );
    }
  } catch (e) {
    console.error("[api/roles] Lỗi kiểm tra rate-limit, cho qua:", e);
  }
  const roles = Object.entries(ROLES).map(([key, label]) => ({ key, label }));
  return NextResponse.json({ roles }, { headers: CORS });
}

export function OPTIONS() {
  return new NextResponse(null, { headers: CORS });
}
