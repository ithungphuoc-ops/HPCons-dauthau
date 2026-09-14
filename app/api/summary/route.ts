import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { getAdminDb } from "@/src/lib/firebase-admin";
import type { Project } from "@/src/types";

export const dynamic = "force-dynamic";

// ⚠️ QUY ƯỚC HẠN MỨC FIRESTORE — ghi lại sau sự cố RESOURCE_EXHAUSTED thật ở app Kho công trình
// (QLK CTR) ngày 13/09/2026 (gói Spark, trần 50.000 lượt đọc/ngày). Rà soát 14/09/2026 phát hiện
// route này (bị App Tổng gọi định kỳ, tần suất ngoài tầm kiểm soát repo này) quét toàn bộ
// collection `projects` mỗi lần gọi, không cache. VÁ: cache 45 giây — route TÓM TẮT cho app KHÁC
// đọc, không cần nối revalidateTag từ các hàm ghi rải rác khắp app (khác việc client SPA tự quét
// collectionGroup ở App.tsx — phần đó KHÔNG dùng unstable_cache được vì chạy phía trình duyệt qua
// Firebase Client SDK, đã tự phát hiện + ghi vào docs/KE-HOACH-SUA-2026-08-17.md, cố ý hoãn).
const layTomTatDaCache = unstable_cache(
  async (): Promise<Project[]> => {
    const db = getAdminDb();
    const snap = await db.collection("projects").get();
    return snap.docs.map((d) => d.data() as Project);
  },
  ["dauthau-summary"],
  { revalidate: 45 },
);

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

  const all = await layTomTatDaCache();
  // "Gói thầu" = bản ghi cấp công việc (loaiBanGhi CONG_VIEC), không tính dự án cha (DU_AN).
  const goiThau = all.filter((p) => p.loaiBanGhi === "CONG_VIEC");

  const dangThucHien = goiThau.filter((p) => p.trangThai === "DANG_THUC_HIEN").length;
  const treTienDoList = goiThau.filter((p) => p.trangThai === "TRE_TIEN_DO");
  const daTrungThau = goiThau.filter((p) => p.tinhTrangDuAn === "Đã trúng thầu").length;
  const rotThau = goiThau.filter((p) => p.tinhTrangDuAn === "Rớt thầu").length;

  return NextResponse.json({
    ok: true,
    total: goiThau.length,
    dang_thuc_hien: dangThucHien,
    tre_tien_do: treTienDoList.length,
    da_trung_thau: daTrungThau,
    rot_thau: rotThau,
    // Top 3 gói trễ tiến độ — hiện việc cụ thể ở mục "Cần chú ý" thay vì ví dụ giả.
    tre_tien_do_list: treTienDoList.slice(0, 8).map((p) => ({
      ten: p.tenDuAn,
      chu_dau_tu: p.chuDauTu ?? "—",
      han: p.ngayHoanThanhDuKienHienTai,
    })),
  });
}
