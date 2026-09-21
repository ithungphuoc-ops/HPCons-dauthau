import { NextRequest, NextResponse } from "next/server";
import { verifyHpcore, fetchCentralRole, parseCookieHeader, SSO_COOKIE_NAME } from "@/src/lib/hpcore";
import { getAdminDb } from "@/src/lib/firebase-admin";
import {
  COLLECTION_TIEN_DO_THIET_KE,
  chuanHoaDuAn,
  type DuAnThietKe,
} from "@/src/lib/tienDoThietKe";

export const dynamic = "force-dynamic";

/**
 * ĐỌC TIẾN ĐỘ THIẾT KẾ CHO MÀN HÌNH "LIÊN KẾT PHÒNG BAN" (chị Trâm chốt 15/09/2026)
 *
 * Hai đường lấy dữ liệu, theo thứ tự ưu tiên:
 *   1. Dữ liệu App Thiết kế đã ĐẨY sang qua webhook (/api/webhook/tien-do-thiet-ke) — đường chính
 *      IT chọn. Đọc từ Firestore nên nhanh và không phụ thuộc app kia còn sống hay không.
 *   2. KÉO trực tiếp từ THIET_KE_API_URL nếu có khai — chỉ dùng khi webhook chưa từng đẩy lần nào,
 *      để ngày đầu nối app không phải ngồi chờ lần đẩy kế tiếp.
 * Không có đường nào thì trả rỗng KÈM LÝ DO để giao diện nói thẳng với người dùng, thay vì bày
 * một màn hình trống không ai hiểu vì sao.
 *
 * ===== QUYỀN =====
 * Phải có phiên App Tổng VÀ được cấp quyền vào app đấu thầu — giống /api/du-an-tong và
 * /api/staff-directory. Tiến độ thiết kế là thông tin nội bộ (tên người thực hiện, dự án đang
 * chạy, chỗ nào trễ), không để lộ cho bất kỳ ai có phiên hpcore hợp lệ.
 */

export async function GET(req: NextRequest) {
  const cookie = parseCookieHeader(req.headers.get("cookie"), SSO_COOKIE_NAME);
  const identity = await verifyHpcore(cookie);
  if (!identity) {
    return NextResponse.json({ error: "NO_HPCORE_SESSION", items: [] }, { status: 401 });
  }
  const role = await fetchCentralRole(identity.uid);
  if (!role) {
    return NextResponse.json({ error: "NO_APP_PERMISSION", items: [] }, { status: 403 });
  }

  // 1) Dữ liệu webhook đã đẩy sang
  try {
    const snap = await getAdminDb().collection(COLLECTION_TIEN_DO_THIET_KE).get();
    if (!snap.empty) {
      const items = snap.docs
        .map((d) => d.data() as DuAnThietKe)
        .filter((x) => !!x?.maDuAn)
        .sort((a, b) => (a.maDuAn || "").localeCompare(b.maDuAn || ""));
      const capNhatLuc = items
        .map((x) => x.capNhatLuc || "")
        .filter(Boolean)
        .sort()
        .pop();
      return NextResponse.json({ items, nguon: "webhook", capNhatLuc });
    }
  } catch (e) {
    // Firestore lỗi thì vẫn thử đường kéo bên dưới — đừng chết hẳn màn hình.
    if (!process.env.THIET_KE_API_URL) {
      return NextResponse.json(
        { items: [], thongBao: `Không đọc được dữ liệu đã nhận (${e instanceof Error ? e.message : "lỗi"}).` },
        { status: 200 },
      );
    }
  }

  // 2) Chưa có gì trong kho → thử kéo trực tiếp
  const url = process.env.THIET_KE_API_URL;
  const key = process.env.THIET_KE_API_KEY;
  if (!url) {
    return NextResponse.json({
      items: [],
      chuaCauHinh: true,
      thongBao:
        "Chưa nhận được dữ liệu từ App Thiết kế. IT cần khai THIET_KE_WEBHOOK_SECRET và cho App Thiết kế đẩy sang /api/webhook/tien-do-thiet-ke.",
    });
  }

  try {
    const res = await fetch(url, {
      headers: key ? { Authorization: `Bearer ${key}` } : {},
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return NextResponse.json(
        { items: [], thongBao: `App Thiết kế trả lỗi ${res.status}.` },
        { status: 200 },
      );
    }
    const raw = await res.json();
    const list: unknown[] = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.items)
        ? raw.items
        : Array.isArray(raw?.data)
          ? raw.data
          : [];
    const items = list
      .map((r) => (r && typeof r === "object" ? chuanHoaDuAn(r as Record<string, unknown>) : null))
      .filter((x): x is DuAnThietKe => !!x);
    return NextResponse.json({ items, nguon: "keo" });
  } catch (e) {
    return NextResponse.json(
      { items: [], thongBao: `Không gọi được App Thiết kế (${e instanceof Error ? e.message : "lỗi mạng"}).` },
      { status: 200 },
    );
  }
}
