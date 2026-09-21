import { NextRequest, NextResponse } from "next/server";
import { verifyHpcore, fetchCentralRole, parseCookieHeader, SSO_COOKIE_NAME } from "@/src/lib/hpcore";
import { getAdminDb } from "@/src/lib/firebase-admin";
import { COLLECTION_DU_AN_TONG, chuanHoaDuAnTong, type DuAnTong } from "@/src/lib/duAnTong";

export const dynamic = "force-dynamic";

/**
 * DANH BẠ DỰ ÁN TỪ "APP THÔNG TIN DỰ ÁN" (chị Trâm chốt 15/09/2026)
 *
 * "Trong nút khởi tạo dự án, chị chỉ cần click chọn mã dự án là sẽ tự động xổ các trường dữ liệu
 *  còn lại. Trường dữ liệu này chỉ là gợi ý, được quyền sửa tay (vì đôi khi ghi sai mô tả)."
 *
 * Hai đường lấy dữ liệu, theo thứ tự ưu tiên:
 *   1. Dữ liệu App Thông tin dự án đã ĐẨY sang qua webhook (/api/webhook/du-an-tong) — đường chính
 *      IT chọn ngày 15/09/2026.
 *   2. KÉO trực tiếp từ DU_AN_TONG_API_URL nếu có khai — dùng khi webhook chưa từng đẩy lần nào.
 * Không có đường nào thì trả danh sách rỗng KÈM LÝ DO, và form vẫn nhập tay bình thường như trước
 * — app không vì thiếu tích hợp mà chặn người dùng làm việc.
 *
 * Kiểu dữ liệu và việc ánh xạ tên trường nằm ở src/lib/duAnTong.ts (dùng chung với webhook).
 *
 * ===== QUYỀN =====
 * Phải có phiên App Tổng VÀ đã được cấp quyền vào app đấu thầu. Danh mục dự án là thông tin kinh
 * doanh (chủ đầu tư, diện tích, giá trị), không để lộ cho bất kỳ ai có phiên hpcore hợp lệ — đúng
 * lỗ hổng đã phải vá ở /api/staff-directory 27/08/2026.
 */

export async function GET(req: NextRequest) {
  // 1) Phải đăng nhập App Tổng
  const cookie = parseCookieHeader(req.headers.get("cookie"), SSO_COOKIE_NAME);
  const identity = await verifyHpcore(cookie);
  if (!identity) {
    return NextResponse.json({ error: "NO_HPCORE_SESSION", items: [] }, { status: 401 });
  }
  // 2) Và phải được cấp quyền vào chính app đấu thầu
  const role = await fetchCentralRole(identity.uid);
  if (!role) {
    return NextResponse.json({ error: "NO_APP_PERMISSION", items: [] }, { status: 403 });
  }

  // 3) Dữ liệu webhook đã đẩy sang
  try {
    const snap = await getAdminDb().collection(COLLECTION_DU_AN_TONG).get();
    if (!snap.empty) {
      const items = snap.docs
        .map((d) => d.data() as DuAnTong)
        .filter((x) => !!x?.maDuAn)
        .sort((a, b) => (a.maDuAn || "").localeCompare(b.maDuAn || ""));
      return NextResponse.json({ items, nguon: "webhook" });
    }
  } catch (e) {
    if (!process.env.DU_AN_TONG_API_URL) {
      return NextResponse.json(
        { items: [], thongBao: `Không đọc được danh mục đã nhận (${e instanceof Error ? e.message : "lỗi"}). Vui lòng nhập tay.` },
        { status: 200 },
      );
    }
  }

  // 4) Chưa có gì trong kho → thử kéo trực tiếp
  const url = process.env.DU_AN_TONG_API_URL;
  const key = process.env.DU_AN_TONG_API_KEY;
  if (!url) {
    return NextResponse.json({
      items: [],
      chuaCauHinh: true,
      thongBao:
        "Chưa nhận được dữ liệu từ App Thông tin dự án. IT cần khai DU_AN_TONG_WEBHOOK_SECRET và cho app kia đẩy sang /api/webhook/du-an-tong. Trong lúc chờ, vui lòng nhập tay.",
    });
  }

  try {
    const res = await fetch(url, {
      headers: key ? { Authorization: `Bearer ${key}` } : {},
      cache: "no-store",
      // Đừng để một app chậm làm treo màn hình đăng ký dự án bên này.
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return NextResponse.json(
        { items: [], thongBao: `App Thông tin dự án trả lỗi ${res.status}. Vui lòng nhập tay.` },
        { status: 200 },
      );
    }
    const raw = await res.json();
    const list: unknown[] = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : Array.isArray(raw?.items) ? raw.items : [];
    const items = list
      .map((r) => (r && typeof r === "object" ? chuanHoaDuAnTong(r as Record<string, unknown>) : null))
      .filter((x): x is DuAnTong => !!x);
    return NextResponse.json({ items, nguon: "keo" });
  } catch (e) {
    // Mạng lỗi / quá hạn chờ: KHÔNG làm vỡ màn hình đăng ký — báo rõ rồi để người dùng nhập tay.
    return NextResponse.json(
      { items: [], thongBao: `Không gọi được App Thông tin dự án (${e instanceof Error ? e.message : "lỗi mạng"}). Vui lòng nhập tay.` },
      { status: 200 },
    );
  }
}
