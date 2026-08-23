import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/src/lib/firebase-admin";
import type { Project } from "@/src/types";

export const dynamic = "force-dynamic";

// API tóm tắt số liệu cho Dashboard toàn cảnh App Tổng (23/08/2026) — route
// MỚI, độc lập với mọi cơ chế xác thực hiện có (SSO cookie, Firebase ID
// Token). Xác thực bằng 1 mã khoá cố định riêng qua header Authorization.
//
// CHÚ Ý: field `giaTriBaoGia` KHÔNG trả về — chính code app này (types.ts)
// ghi chú "chưa có ô nhập nên tạm để trống trên báo cáo", nên không đáng tin
// để tổng hợp "giá trị đang theo đuổi". Chỉ trả các field đếm được chắc chắn.
export async function GET(req: NextRequest) {
  const apiKeyYeuCau = process.env.HPCONS_PORTAL_API_KEY;
  const auth = req.headers.get("authorization") ?? "";
  const apiKeyGui = auth.startsWith("Bearer ") ? auth.slice(7) : req.headers.get("x-api-key");
  if (!apiKeyYeuCau || apiKeyGui !== apiKeyYeuCau) {
    return NextResponse.json({ error: "Thiếu hoặc sai API Key." }, { status: 401 });
  }

  const db = getAdminDb();
  const snap = await db.collection("projects").get();
  const all = snap.docs.map((d) => d.data() as Project);
  // "Gói thầu" = bản ghi cấp công việc (loaiBanGhi CONG_VIEC), không tính dự án cha (DU_AN).
  const goiThau = all.filter((p) => p.loaiBanGhi === "CONG_VIEC");

  const dangThucHien = goiThau.filter((p) => p.trangThai === "DANG_THUC_HIEN").length;
  const treTienDo = goiThau.filter((p) => p.trangThai === "TRE_TIEN_DO").length;
  const daTrungThau = goiThau.filter((p) => p.tinhTrangDuAn === "Đã trúng thầu").length;
  const rotThau = goiThau.filter((p) => p.tinhTrangDuAn === "Rớt thầu").length;

  return NextResponse.json({
    ok: true,
    total: goiThau.length,
    dang_thuc_hien: dangThucHien,
    tre_tien_do: treTienDo,
    da_trung_thau: daTrungThau,
    rot_thau: rotThau,
  });
}
