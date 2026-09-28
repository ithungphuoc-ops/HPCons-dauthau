import { NextRequest, NextResponse } from "next/server";
import { verifyHpcore, fetchCentralRole, parseCookieHeader, SSO_COOKIE_NAME } from "@/src/lib/hpcore";
import { getAdminDb } from "@/src/lib/firebase-admin";
import { chuanHoaMaDuAn } from "@/src/lib/maPhongBan";
import {
  COLLECTION_TIEN_DO_THIET_KE_CHI_TIET,
  type TienDoThietKeChiTiet,
} from "@/src/lib/tienDoThietKeChiTietTypes";

export const dynamic = "force-dynamic";

/**
 * ĐỌC TIẾN ĐỘ THIẾT KẾ CHI TIẾT CHO TAB "LIÊN KẾT PHÒNG BAN" (OpenSpec change
 * `lien-ket-thiet-ke-dau-thau`, Sếp duyệt 26/09/2026)
 *
 * Trả mọi bản App Thiết kế đã Share sang qua /api/webhook/tien-do-thiet-ke-chi-tiet, MỖI DỰ ÁN
 * BÊN THIẾT KẾ MỘT BẢN (khoá `khoaDuAn`, hợp đồng bản 2 — sửa 26/09/2026 theo demo bản 02), kể cả
 * dự án chưa gắn mã. Chỉ đọc Firestore, không gọi sang App Thiết kế.
 *
 * Bản ghi kiểu bản 01 (khoá theo mã, KHÔNG có `khoaDuAn`) bị bỏ qua: bản 01 chưa từng chạy
 * production (chưa đặt secret), và nếu có thì sẽ trùng dự án với bản 2 cùng dự án đó.
 *
 * ===== QUYỀN =====
 * Phiên App Tổng + được cấp quyền vào app đấu thầu, như /api/tien-do-thiet-ke. Chuyên viên (L3) được
 * lọc NGAY Ở MÁY CHỦ chỉ còn bản có `maDuAn` KHÁC RỖNG và thuộc gói mình được giao (xem
 * maDuAnChuyenVienDuocXem) — bản chưa gắn mã không biết thuộc gói nào nên Chuyên viên không thấy
 * (Sếp duyệt theo mặc định đề xuất ở demo bản 02). Trả kèm `soBiAn` để giao diện hiện câu nhắc.
 * Giao diện vẫn lọc thêm bằng `chiMaDuAn`, cùng một luật nên không lệch nhau.
 */

/**
 * LỌC CHUYÊN VIÊN Ở MÁY CHỦ (CodeRabbit PR #12 — chỉ lọc ở giao diện thì gọi thẳng API là lách được).
 * Chép ĐÚNG luật `rbacProjects` + `maDuAnDuocXem` trong src/App.tsx: vai trò STAFF chỉ thấy mã ô 1
 * của các gói có `thucHienId` hoặc `thucHienIds` chứa mã nhân sự của mình. Vai trò khác → null
 * (không lọc), giống giao diện.
 *
 * Vai trò lấy từ `staff/{doc}.role` (vai trò nội bộ app, route SSO giữ nguyên nếu đã có), rơi về
 * vai trò App Tổng khi chưa có hồ sơ. Mã nhân sự = uid, ĐÚNG như giao diện khớp `staff.find(s =>
 * s.id === uid)` (App.tsx). Không có hồ sơ mà vai trò là STAFF → tập rỗng (thà không thấy gì còn
 * hơn thấy hết).
 */
async function maDuAnChuyenVienDuocXem(
  db: FirebaseFirestore.Firestore,
  uid: string,
  vaiTroAppTong: string,
): Promise<Set<string> | null> {
  const staffDoc = await db.collection("staff").doc(uid).get();
  const vaiTro = ((staffDoc.exists ? staffDoc.data()?.role : null) as string | null) || vaiTroAppTong;
  if (vaiTro !== "STAFF") return null;
  if (!staffDoc.exists) return new Set();

  const staffId = staffDoc.id;
  const [chinh, phu] = await Promise.all([
    db.collection("projects").where("thucHienId", "==", staffId).select("projectId").get(),
    db.collection("projects").where("thucHienIds", "array-contains", staffId).select("projectId").get(),
  ]);
  const ma = new Set<string>();
  for (const d of [...chinh.docs, ...phu.docs]) {
    const m = chuanHoaMaDuAn(d.get("projectId"));
    if (m) ma.add(m);
  }
  return ma;
}

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
    const db = getAdminDb();
    const maDuocXem = await maDuAnChuyenVienDuocXem(db, identity.uid, role);
    const snap = await db.collection(COLLECTION_TIEN_DO_THIET_KE_CHI_TIET).get();
    const tatCa = snap.docs
      .map((d) => d.data() as TienDoThietKeChiTiet)
      .filter((x) => !!x?.khoaDuAn);
    const items = tatCa
      .filter((x) => {
        if (!maDuocXem) return true;
        const ma = chuanHoaMaDuAn(x.maDuAn);
        return !!ma && maDuocXem.has(ma);
      })
      // Dự án có mã lên trước theo mã, dự án chưa mã xếp sau theo tên — giống trang Tiến độ bên
      // Thiết kế nhìn từ trên xuống.
      .sort((a, b) => {
        const ma = a.maDuAn || "", mb = b.maDuAn || "";
        if (!!ma !== !!mb) return ma ? -1 : 1;
        return ma.localeCompare(mb) || (a.tenDuAn || "").localeCompare(b.tenDuAn || "");
      });
    return NextResponse.json({ items, soBiAn: tatCa.length - items.length });
  } catch (e) {
    return NextResponse.json(
      { items: [], thongBao: `Không đọc được tiến độ chi tiết đã nhận (${e instanceof Error ? e.message : "lỗi"}).` },
      { status: 200 },
    );
  }
}
