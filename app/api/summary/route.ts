import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { getAdminDb } from "@/src/lib/firebase-admin";
import { maHoSo } from "@/src/lib/utils";
import type { Project } from "@/src/types";

// Bản sao THUẦN (không JSX/React) của 3 hàm bên `src/components/KanbanBoard.tsx` +
// `src/App.tsx` (isWorkDone, dòng ~3046) — KHÔNG import trực tiếp từ 2 file đó vì
// KanbanBoard.tsx kéo theo `../App` (file client 5900+ dòng) vào route server này,
// dễ vỡ build/runtime. Đổi luật deriveKanbanStep/dangTreHan/isWorkDone bên đó thì
// PHẢI sửa lại y hệt ở đây — không có cách nào tự đồng bộ.
const BUOC_XONG_PHAN_PHONG = 4;
function deriveKanbanStep(p: Project): number {
  if (p.kanbanStep && p.kanbanStep >= 1 && p.kanbanStep <= 7) return p.kanbanStep;
  if (p.tinhTrangDuAn === "Đã trúng thầu") return 6;
  if (p.tinhTrangDuAn === "Rớt thầu") return 7;
  if (p.trangThai === "HOAN_THANH_DUNG_HAN" || p.trangThai === "HOAN_THANH_TRE_HAN") return BUOC_XONG_PHAN_PHONG;
  if (p.tienDoBoPhan > 0) return 2;
  return 1;
}
function dangTreHan(p: Project): boolean {
  return p.trangThai === "TRE_TIEN_DO" && deriveKanbanStep(p) < BUOC_XONG_PHAN_PHONG;
}
function isWorkDone(p: Project): boolean {
  return (
    p.trangThai === "HOAN_THANH_DUNG_HAN" ||
    p.trangThai === "HOAN_THANH_TRE_HAN" ||
    p.tinhTrangDuAn === "Đã trúng thầu" ||
    p.tinhTrangDuAn === "Rớt thầu" ||
    deriveKanbanStep(p) >= BUOC_XONG_PHAN_PHONG
  );
}

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

  const treTienDoList = goiThau.filter((p) => p.trangThai === "TRE_TIEN_DO");
  const daTrungThau = goiThau.filter((p) => p.tinhTrangDuAn === "Đã trúng thầu").length;
  const rotThau = goiThau.filter((p) => p.tinhTrangDuAn === "Rớt thầu").length;

  // ===== "Hiện trạng gói thầu" (28/09/2026, Sếp yêu cầu Owner Dashboard hiện đúng biểu đồ
  // này thay vì số đơn dễ hiểu lầm) — Y HỆT 4 nhóm StatsDashboard.tsx tự dùng cho app này,
  // để 2 nơi không bao giờ lệch số. "dangThucHien" tính bằng PHẦN CÒN LẠI nên 4 nhóm LUÔN
  // cộng đúng bằng tổng (xem StatsDashboard.tsx dòng ~209-214) — khác hẳn "dang_thuc_hien"
  // cũ bên dưới (đếm thẳng theo trangThai==='DANG_THUC_HIEN', 1 trục riêng, cộng không ra
  // tổng khi đặt cạnh đã trúng/rớt/trễ — đây chính là thứ gây hiểu lầm ở card cũ).
  const hoanThanhDungHan = goiThau.filter((p) => p.trangThai === "HOAN_THANH_DUNG_HAN").length;
  const hoanThanhTreHan = goiThau.filter((p) => p.trangThai === "HOAN_THANH_TRE_HAN").length;
  const dangTreHanCount = goiThau.filter(dangTreHan).length;
  const dangThucHienMoi = goiThau.length - dangTreHanCount - hoanThanhDungHan - hoanThanhTreHan;

  // ===== Danh sách chi tiết từng hồ sơ — cho popup "Tổng hợp tình trạng các hồ sơ đấu thầu"
  // bên Owner Dashboard (giống hệt khối cùng tên trong App.tsx dòng ~5822). `hanThau` lấy
  // thẳng `ngayHoanThanhDuKienHienTai` (đã cộng dồn offset Delay Logs sẵn — xem comment field
  // này trong src/types.ts), KHÔNG tính lại `getTenderDeadline` (phụ thuộc tasks/vòng/round,
  // quá phức tạp để bê nguyên sang route server, rủi ro tính sai hơn là dùng field cache sẵn).
  const today = new Date().toISOString().slice(0, 10);
  const hoSo = goiThau
    .map((p) => {
      const han = p.ngayHoanThanhDuKienHienTai ?? null;
      return {
        id: maHoSo(p),
        hangMuc: p.hangMuc,
        tenDuAn: p.tenDuAn,
        tienDoBoPhan: p.tienDoBoPhan ?? 0,
        tienDoPhong: p.tienDoPhong ?? 0,
        trangThai: p.trangThai,
        daXong: isWorkDone(p),
        hanThau: han,
        quaHan: p.trangThai === "DANG_THUC_HIEN" && !!han && han < today,
      };
    })
    // Hạn thầu gần nhất lên trước (giống thứ tự Dashboard thật) — thiếu hạn thì đẩy xuống cuối.
    .sort((a, b) => (a.hanThau ?? "9999-99-99").localeCompare(b.hanThau ?? "9999-99-99"));

  return NextResponse.json({
    ok: true,
    total: goiThau.length,
    dang_thuc_hien: dangThucHienMoi,
    hoan_thanh_dung_han: hoanThanhDungHan,
    hoan_thanh_tre_han: hoanThanhTreHan,
    dang_tre_han: dangTreHanCount,
    da_trung_thau: daTrungThau,
    rot_thau: rotThau,
    ho_so: hoSo,
    // Giữ 2 field cũ để không phá bất kỳ nơi nào khác lỡ đang đọc route này ngoài Owner
    // Dashboard — "tre_tien_do" đếm MỌI TRE_TIEN_DO (khác "dang_tre_han" ở trên, đã loại
    // bớt theo bước Kanban như dangTreHan() thật).
    tre_tien_do: treTienDoList.length,
    tre_tien_do_list: treTienDoList.slice(0, 8).map((p) => ({
      ten: p.tenDuAn,
      chu_dau_tu: p.chuDauTu ?? "—",
      han: p.ngayHoanThanhDuKienHienTai,
    })),
  });
}
