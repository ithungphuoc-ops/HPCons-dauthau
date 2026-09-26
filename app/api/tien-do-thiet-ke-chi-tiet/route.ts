import { NextRequest, NextResponse } from "next/server";
import { verifyHpcore, fetchCentralRole, parseCookieHeader, SSO_COOKIE_NAME } from "@/src/lib/hpcore";
import { getAdminDb } from "@/src/lib/firebase-admin";
import {
  COLLECTION_TIEN_DO_THIET_KE_CHI_TIET,
  type TienDoThietKeChiTiet,
} from "@/src/lib/tienDoThietKeChiTietTypes";

export const dynamic = "force-dynamic";

/**
 * ĐỌC TIẾN ĐỘ THIẾT KẾ CHI TIẾT CHO TAB "LIÊN KẾT PHÒNG BAN" (OpenSpec change
 * `lien-ket-thiet-ke-dau-thau`, Sếp duyệt 26/09/2026)
 *
 * Trả mọi bản App Thiết kế đã Share sang qua /api/webhook/tien-do-thiet-ke-chi-tiet, mỗi mã dự
 * án một bản. Chỉ đọc Firestore, không gọi sang App Thiết kế.
 *
 * ===== QUYỀN =====
 * Giống hệt /api/tien-do-thiet-ke: phiên App Tổng + được cấp quyền vào app đấu thầu. Lọc riêng cho
 * Chuyên viên (L3 — chỉ mã thuộc gói mình được giao) làm ở giao diện bằng `chiMaDuAn`, CÙNG luật
 * bảng tóm tắt đang dùng, để không đẻ ra luật quyền thứ hai rồi lệch nhau.
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

  try {
    const snap = await getAdminDb().collection(COLLECTION_TIEN_DO_THIET_KE_CHI_TIET).get();
    const items = snap.docs
      .map((d) => d.data() as TienDoThietKeChiTiet)
      .filter((x) => !!x?.maDuAn)
      .sort((a, b) => (a.maDuAn || "").localeCompare(b.maDuAn || ""));
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json(
      { items: [], thongBao: `Không đọc được tiến độ chi tiết đã nhận (${e instanceof Error ? e.message : "lỗi"}).` },
      { status: 200 },
    );
  }
}
