import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/src/lib/firebase-admin";
import { xacThucWebhook } from "@/src/lib/webhookAuth";
import {
  COLLECTION_TIEN_DO_THIET_KE,
  chuanHoaDuAn,
  docIdTuMa,
  type DuAnThietKe,
} from "@/src/lib/tienDoThietKe";

export const dynamic = "force-dynamic";

/**
 * WEBHOOK 2/2 — APP THIẾT KẾ ĐẨY TIẾN ĐỘ SANG (IT yêu cầu 15/09/2026)
 *
 * Bước sau trong chuỗi chị Trâm chốt: có mã dự án từ App Thông tin dự án rồi, bấm vào mã đó thì
 * bên này phải có sẵn tiến độ thiết kế để xổ ra — dữ liệu đó chính là thứ webhook này nhận.
 * Ghép hai app BẰNG MÃ DỰ ÁN.
 *
 * ===== IT CẮM VÀO ĐÂY =====
 *   POST https://<app-dau-thau>/api/webhook/tien-do-thiet-ke
 *   Header: Authorization: Bearer <THIET_KE_WEBHOOK_SECRET>
 *           (chưa khai biến thì route trả 503 — cố ý, không mở toang trong lúc chờ cấu hình)
 *   Body  : { "items": [ {...} ] }  hoặc  { ... } cho một dự án lẻ
 *
 * Ví dụ body — đúng các cột bảng báo cáo bên App Thiết kế:
 *   {
 *     "items": [
 *       {
 *         "maDuAn": "250142-HPCS",
 *         "tenDuAn": "Nhà máy ABC - Giai đoạn 1",
 *         "namTaiChinh": "2026-2027",
 *         "loaiDuAn": "Nhà máy",
 *         "tinhTrang": "Đang thực hiện",
 *         "ngayLap": "2026-08-03",
 *         "ngayHoanThanh": "2026-10-15",
 *         "soTask": 24,
 *         "nguoiThucHien": "Nguyễn Văn A",
 *         "treHan": 0,
 *         "hangMuc": [
 *           {
 *             "ten": "Kiến trúc", "loaiDuAn": "Nhà máy", "tinhTrang": "Hoàn thành",
 *             "ngayLap": "2026-08-03", "ngayHoanThanh": "2026-09-10",
 *             "soTask": 8, "soTaskXong": 8, "nguoiThucHien": "Trần B", "treHan": 0
 *           }
 *         ]
 *       }
 *     ]
 *   }
 *
 * KHÔNG cần gửi "vị trí lưu file" — chị Trâm bỏ cột đó, bên này không lưu.
 * Trường nào tên khác thì sửa `chuanHoaDuAn()` trong src/lib/tienDoThietKe.ts — MỘT chỗ duy nhất.
 *
 * ===== HÀNH VI =====
 *  - Upsert theo mã dự án: đẩy lại bao nhiêu lần cũng không sinh bản trùng.
 *  - Danh sách hạng mục GHI ĐÈ nguyên khối (không merge từng phần tử): hạng mục bị xoá bên App
 *    Thiết kế phải biến mất bên này, nếu merge thì hạng mục cũ nằm lại vĩnh viễn.
 */

const TOI_DA_MOI_LAN = 500;

export async function POST(req: NextRequest) {
  const auth = xacThucWebhook(req, "THIET_KE_WEBHOOK_SECRET");
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
        : [goc];

  if (list.length > TOI_DA_MOI_LAN) {
    return NextResponse.json(
      { ok: false, loi: `Mỗi lần đẩy tối đa ${TOI_DA_MOI_LAN} dự án. Vui lòng chia nhỏ.` },
      { status: 413 },
    );
  }

  const hopLe: DuAnThietKe[] = [];
  let boQua = 0;
  for (const r of list) {
    const item = r && typeof r === "object" ? chuanHoaDuAn(r as Record<string, unknown>) : null;
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
    for (let i = 0; i < hopLe.length; i += 400) {
      const batch = db.batch();
      for (const item of hopLe.slice(i, i + 400)) {
        const ref = db.collection(COLLECTION_TIEN_DO_THIET_KE).doc(docIdTuMa(item.maDuAn));
        // set KHÔNG merge: xem ghi chú "ghi đè nguyên khối" ở đầu file.
        batch.set(ref, { ...item, capNhatLuc });
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
    webhook: "tien-do-thiet-ke",
    huongDan: "POST JSON { items: [...] } kèm header Authorization: Bearer <THIET_KE_WEBHOOK_SECRET>",
    daCauHinhSecret: !!process.env.THIET_KE_WEBHOOK_SECRET,
  });
}
