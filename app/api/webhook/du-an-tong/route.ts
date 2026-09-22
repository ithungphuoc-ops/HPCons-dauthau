import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/src/lib/firebase-admin";
import { xacThucWebhook } from "@/src/lib/webhookAuth";
import { COLLECTION_DU_AN_TONG, chuanHoaDuAnTong, docIdTuMaDuAn, type DuAnTong } from "@/src/lib/duAnTong";

export const dynamic = "force-dynamic";

/**
 * WEBHOOK 1/2 — APP THÔNG TIN DỰ ÁN ĐẨY DANH MỤC DỰ ÁN SANG (IT yêu cầu 15/09/2026)
 *
 * Đây là BƯỚC ĐẦU trong chuỗi chị Trâm chốt: App Thông tin dự án đổ mã dự án + thông tin dự án
 * sang, sau đó bấm vào mã để lấy tiến độ thiết kế (webhook 2/2).
 *
 * ===== IT CẮM VÀO ĐÂY =====
 *   POST https://<app-dau-thau>/api/webhook/du-an-tong
 *   Header: Authorization: Bearer <THIET_KE_WEBHOOK_SECRET của riêng app này>
 *           (biến: DU_AN_TONG_WEBHOOK_SECRET — chưa khai thì route trả 503, cố ý)
 *   Body  : { "items": [ {...}, {...} ] }  hoặc  { ... } cho một dự án lẻ
 *
 * Ví dụ body:
 *   {
 *     "items": [
 *       {
 *         "maDuAn": "250142-HPCS",
 *         "tenDuAn": "Nhà máy ABC - Giai đoạn 1",
 *         "chuDauTu": "Công ty TNHH ABC",
 *         "diaChi": "KCN Sóng Thần, Bình Dương",
 *         "quocTich": "Nhật Bản",
 *         "hinhThucXayDung": "Xây mới",
 *         "hoSoPhatThau": "CĐT phát thầu",
 *         "dienTichDat": 12000
 *       }
 *     ]
 *   }
 *
 * Trường nào tên khác thì sửa `chuanHoaDuAnTong()` trong src/lib/duAnTong.ts — MỘT chỗ duy nhất.
 *
 * ===== HÀNH VI =====
 *  - Ghi đè theo MÃ DỰ ÁN (upsert), nên App Thông tin dự án đẩy lại bao nhiêu lần cũng được,
 *    không sinh bản trùng. CỐ Ý không xoá dự án vắng mặt trong lần đẩy này: một lần đẩy thiếu
 *    (lọc sai, đẩy từng phần) sẽ không thổi bay cả danh mục.
 *  - Bản ghi không có mã dự án thì bỏ qua và ĐẾM vào `boQua` để bên kia biết mà sửa, thay vì
 *    im lặng nuốt mất.
 */

const TOI_DA_MOI_LAN = 500;

export async function POST(req: NextRequest) {
  const auth = xacThucWebhook(req, "DU_AN_TONG_WEBHOOK_SECRET");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, loi: auth.loi }, { status: auth.status || 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ ok: false, loi: "Body không phải JSON hợp lệ." }, { status: 400 });
  }

  const goc = raw as Record<string, unknown> | unknown[];
  const list: unknown[] = Array.isArray(goc)
    ? goc
    : Array.isArray((goc as Record<string, unknown>)?.items)
      ? ((goc as Record<string, unknown>).items as unknown[])
      : Array.isArray((goc as Record<string, unknown>)?.data)
        ? ((goc as Record<string, unknown>).data as unknown[])
        : [goc]; // một dự án lẻ cũng nhận

  if (list.length > TOI_DA_MOI_LAN) {
    return NextResponse.json(
      { ok: false, loi: `Mỗi lần đẩy tối đa ${TOI_DA_MOI_LAN} dự án. Vui lòng chia nhỏ.` },
      { status: 413 },
    );
  }

  const hopLe: DuAnTong[] = [];
  let boQua = 0;
  for (const r of list) {
    const item = r && typeof r === "object" ? chuanHoaDuAnTong(r as Record<string, unknown>) : null;
    if (item) hopLe.push(item);
    else boQua += 1;
  }

  if (hopLe.length === 0) {
    return NextResponse.json(
      { ok: false, loi: "Không có bản ghi nào dùng được (thiếu mã dự án).", boQua },
      { status: 400 },
    );
  }

  try {
    const db = getAdminDb();
    const capNhatLuc = new Date().toISOString();
    // Firestore giới hạn 500 thao tác mỗi batch — chia lô cho chắc.
    for (let i = 0; i < hopLe.length; i += 400) {
      const batch = db.batch();
      for (const item of hopLe.slice(i, i + 400)) {
        const ref = db.collection(COLLECTION_DU_AN_TONG).doc(docIdTuMaDuAn(item.maDuAn));
        batch.set(ref, { ...item, capNhatLuc }, { merge: true });
      }
      await batch.commit();
    }
    return NextResponse.json({ ok: true, daNhan: hopLe.length, boQua, capNhatLuc });
  } catch (e) {
    return NextResponse.json(
      { ok: false, loi: `Lỗi ghi dữ liệu: ${e instanceof Error ? e.message : "không rõ"}` },
      { status: 500 },
    );
  }
}

/** Cho IT thử nhanh xem đã cắm đúng địa chỉ chưa (không lộ dữ liệu, không cần secret). */
export async function GET() {
  return NextResponse.json({
    ok: true,
    webhook: "du-an-tong",
    huongDan: "POST JSON { items: [...] } kèm header Authorization: Bearer <DU_AN_TONG_WEBHOOK_SECRET>",
    daCauHinhSecret: !!process.env.DU_AN_TONG_WEBHOOK_SECRET,
  });
}
