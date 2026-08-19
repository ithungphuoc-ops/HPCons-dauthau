import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/src/lib/apiRateLimit";

// Danh sách vai trò CỦA CHÍNH app đấu thầu — App Tổng (account.hpcore.vn) gọi
// endpoint này để dựng dropdown gán quyền tại trang "Quản lý ứng dụng", không
// hard-code danh sách vai trò ở phía App Tổng. Public, CORS mở cho *.hpcore.vn.
// Thang Level chị Trâm chốt 17/08/2026:
//   L1 = Trưởng phòng + Phó phòng · L2 = Quản lý · L3 = Nhân viên · L4 = Ban giám đốc.
// Nhãn ở đây hiện lên dropdown gán quyền của App Tổng, nên phải khớp đúng thang trên —
// trước đây L1 ghi "Ban Giám đốc / Trưởng phòng" và L4 ghi "Khách — chỉ xem" nên người phân
// quyền bên App Tổng gán Ban giám đốc vào Level 1 (toàn quyền) thay vì Level 4 (chỉ xem).
const ROLES = {
  BOOD: "Trưởng phòng / Phó phòng (Level 1)",
  MANAGER: "Quản lý (Level 2)",
  STAFF: "Nhân viên (Level 3)",
  // Level 4 — Ban giám đốc: XEM HẾT nhưng KHÔNG thao tác (không thêm/sửa/xóa/duyệt).
  VIEWER: "Ban giám đốc — chỉ xem (Level 4)",
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
