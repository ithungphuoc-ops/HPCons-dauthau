import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/src/lib/firebase-admin";
import { kiemGoiWebhook, type WebhookEvent } from "@/src/lib/webhookHmac";
import { chuanHoaMaDuAn } from "@/src/lib/maPhongBan";
import {
  COLLECTION_TIEN_DO_THIET_KE_CHI_TIET,
  LUAT_KHOA_DU_AN,
  type DongTienDoThietKe,
  type TienDoThietKeChiTiet,
} from "@/src/lib/tienDoThietKeChiTietTypes";

export const dynamic = "force-dynamic";

/**
 * CHIỀU 1 — APP THIẾT KẾ ĐẨY TIẾN ĐỘ CHI TIẾT SANG (OpenSpec change `lien-ket-thiet-ke-dau-thau`,
 * Sếp duyệt 26/09/2026)
 *
 * Trưởng nhóm Thiết kế bấm "Share sang Đấu thầu" ở trang Tiến độ → App Thiết kế gửi MỖI DỰ ÁN MỘT
 * sự kiện `tien_do.chia_se` tới đây, đủ các dòng công việc (tên, người thực hiện, bắt đầu, kết
 * thúc, tình trạng, trễ hạn, nội dung thay đổi).
 *
 * ⚠ ĐÂY LÀ CỔNG MỚI, đặt CẠNH cổng Bearer cũ /api/webhook/tien-do-thiet-ke (tóm tắt theo dự án) —
 * KHÔNG sửa cổng cũ: có thể đang có người dùng, và hai kiểu xác thực trên cùng một địa chỉ dễ nhầm.
 *
 * ===== XÁC THỰC =====
 *   Header x-webhook-signature = hex(HMAC-SHA256(WEBHOOK_SECRET_DT_PTK, rawBody))
 *          x-webhook-timestamp = event.timestamp (BẮT BUỘC bằng timestamp trong thân, lệch ≤ 5 phút)
 *   Secret gắn với nguồn: ký bằng secret cặp Đấu thầu–Thiết kế thì source_app PHẢI là "ptk".
 *   Chưa khai secret → 503 (không mở toang cổng trong lúc chờ cấu hình — cùng nguyên tắc webhookAuth.ts).
 *
 * ===== HÀNH VI =====
 *  - event_id đã xử lý → { ok:true, deduped:true } (chống gửi lại).
 *  - HỢP ĐỒNG BẢN 2 (sửa 26/09/2026 theo demo bản 02 Sếp duyệt): Thiết kế gửi MỌI dự án đang hiện
 *    trên trang Tiến độ, kể cả dự án chưa gắn mã. Nên:
 *      · `khoaDuAn` BẮT BUỘC, khớp ^[A-Za-z0-9_-]{1,128}$ (khoá ổn định bên Thiết kế) → sai là 400.
 *        Khoá này làm luôn doc ID — regex chặn "/", ".." nên không thể trỏ sang đường dẫn khác.
 *      · `tenDuAn` BẮT BUỘC không rỗng → thiếu là 400 (dự án chưa mã thì tên là thứ duy nhất để đọc).
 *      · `maDuAn` chuẩn hoá (bỏ khoảng trắng, HOA), CHO PHÉP RỖNG, KHÔNG còn đòi luật YY10xx-HPCS:
 *        mã của phòng nào cũng nhận, chỉ để hiển thị + lọc quyền Chuyên viên.
 *  - Ghi đè NGUYÊN KHỐI (set KHÔNG merge) `tien_do_thiet_ke_chi_tiet/{khoaDuAn}`: dòng đã xoá bên
 *    Thiết kế phải biến mất bên này, merge thì dòng cũ nằm lại vĩnh viễn.
 *  - Mỗi dòng lọc theo DANH SÁCH TRẮNG trường → email người phụ trách (assigneeEmail...) không lưu.
 */

const COLLECTION_PROCESSED = "processed_events";
const TEN_BIEN_SECRET = "WEBHOOK_SECRET_DT_PTK";
const SOURCE_APP_HOP_LE = "ptk";
const EVENT_TYPE = "tien_do.chia_se";
// Document Firestore tối đa 1 MiB — vài nghìn dòng công việc đã sát ngưỡng. Một dự án thiết kế
// thật chỉ vài chục đến vài trăm dòng; quá mức này nhiều khả năng là gửi nhầm cả kho.
const TOI_DA_DONG = 2000;

const chu = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** Danh sách trắng trường của một dòng — cố ý không chép nguyên object bên kia gửi. */
const chuanHoaDong = (r: unknown): DongTienDoThietKe | null => {
  if (!r || typeof r !== "object") return null;
  const o = r as Record<string, unknown>;
  const id = chu(o.id);
  const title = chu(o.title);
  if (!id || !title) return null;
  return {
    id,
    title,
    assigneeName: chu(o.assigneeName),
    status: chu(o.status),
    startDate: chu(o.startDate),
    endDate: chu(o.endDate),
    overdue: o.overdue === true,
    changeNote: chu(o.changeNote),
    source: o.source === "actual" ? "actual" : "planned",
  };
};

export async function POST(req: NextRequest) {
  const secret = process.env[TEN_BIEN_SECRET];
  if (!secret) {
    return NextResponse.json(
      { ok: false, loi: `Chưa cấu hình ${TEN_BIEN_SECRET} phía app đấu thầu. Webhook tạm khoá cho tới khi IT khai biến này.` },
      { status: 503 },
    );
  }

  // Đọc THÂN THÔ — chữ ký ký trên đúng chuỗi bytes bên gửi gửi, parse rồi stringify lại sẽ lệch.
  const rawBody = await req.text();
  const kq = kiemGoiWebhook(
    rawBody,
    req.headers.get("x-webhook-signature"),
    req.headers.get("x-webhook-timestamp"),
    secret,
  );
  if (!kq.valid) {
    return NextResponse.json({ ok: false, loi: kq.reason }, { status: 401 });
  }

  const event = JSON.parse(rawBody) as WebhookEvent<Record<string, unknown>>;
  if (event?.source_app !== SOURCE_APP_HOP_LE) {
    // Secret đúng nhưng tự xưng nguồn khác → coi như không xác thực được (gắn secret với nguồn).
    return NextResponse.json({ ok: false, loi: "source_app không khớp secret." }, { status: 401 });
  }
  if (typeof event.event_id !== "string" || !event.event_id || typeof event.event_type !== "string") {
    return NextResponse.json({ ok: false, loi: "Payload thiếu event_id hoặc event_type." }, { status: 400 });
  }
  if (event.event_type !== EVENT_TYPE) {
    return NextResponse.json({ ok: false, loi: `Không có handler cho event_type: ${event.event_type}` }, { status: 400 });
  }

  const data = (event.data && typeof event.data === "object" ? event.data : {}) as Record<string, unknown>;
  const khoaDuAn = typeof data.khoaDuAn === "string" ? data.khoaDuAn : "";
  // Firestore cấm doc ID dạng __...__ (tên dành riêng) — regex cho qua nên chặn thêm ở đây, để
  // trả 400 rõ ràng thay vì 500 lúc ghi.
  if (!LUAT_KHOA_DU_AN.test(khoaDuAn) || /^__.*__$/.test(khoaDuAn)) {
    return NextResponse.json(
      { ok: false, loi: "data.khoaDuAn thiếu hoặc sai dạng (chỉ chữ, số, _ và -, tối đa 128 ký tự)." },
      { status: 400 },
    );
  }
  const tenDuAn = chu(data.tenDuAn);
  if (!tenDuAn) {
    return NextResponse.json({ ok: false, loi: "data.tenDuAn không được để trống." }, { status: 400 });
  }
  // Mã của BẤT KỲ phòng nào, hoặc "" nếu dự án chưa gắn mã — không từ chối theo luật mã nữa.
  const maDuAn = chuanHoaMaDuAn(data.maDuAn);
  if (!Array.isArray(data.rows)) {
    return NextResponse.json({ ok: false, loi: "data.rows phải là mảng." }, { status: 400 });
  }
  if (data.rows.length > TOI_DA_DONG) {
    return NextResponse.json({ ok: false, loi: `Tối đa ${TOI_DA_DONG} dòng công việc mỗi dự án.` }, { status: 413 });
  }

  const rows = data.rows.map(chuanHoaDong).filter((x): x is DongTienDoThietKe => !!x);
  const viewMode = data.viewMode === "actual" || data.viewMode === "combined" ? data.viewMode : "planned";
  const nhanLuc = new Date().toISOString();
  const banGhi: TienDoThietKeChiTiet = {
    khoaDuAn,
    maDuAn,
    tenDuAn,
    viewMode,
    sharedByName: chu(data.sharedByName),
    sharedAt: chu(data.sharedAt),
    rows,
    nhanLuc,
  };

  try {
    const db = getAdminDb();
    const processedRef = db.collection(COLLECTION_PROCESSED).doc(event.event_id);
    const ref = db.collection(COLLECTION_TIEN_DO_THIET_KE_CHI_TIET).doc(khoaDuAn);
    // Một giao dịch: tra event_id + ghi dữ liệu + đánh dấu đã xử lý. Đánh dấu trước rồi ghi sau
    // thì ghi lỗi giữa chừng là mất luôn lần Share đó (gửi lại bị coi là trùng); ghi trước rồi
    // đánh dấu sau thì hai lượt gửi trùng đến cùng lúc đều lọt qua.
    const trung = await db.runTransaction(async (tx) => {
      const daXuLy = await tx.get(processedRef);
      if (daXuLy.exists) return true;
      // Chặn bản CŨ đến muộn đè bản MỚI (CodeRabbit PR #12): hai lần Share cùng dự án trong vài phút,
      // lần gửi lại của sự kiện cũ tới sau thì phải bỏ. `sharedAt` là ISO do App Thiết kế đặt nên so
      // chuỗi đúng thứ tự thời gian. Vẫn đánh dấu đã xử lý để lần gửi lại sau không hỏi lại.
      const hienTai = await tx.get(ref);
      const sharedAtDangLuu = (hienTai.data() as TienDoThietKeChiTiet | undefined)?.sharedAt || "";
      const cuHon = !!sharedAtDangLuu && !!banGhi.sharedAt && banGhi.sharedAt < sharedAtDangLuu;
      if (!cuHon) tx.set(ref, banGhi); // KHÔNG merge — xem "ghi đè nguyên khối" ở đầu file
      tx.set(processedRef, {
        event_type: event.event_type,
        source_app: event.source_app,
        khoaDuAn,
        maDuAn,
        processedAt: nhanLuc,
      });
      return false;
    });
    if (trung) return NextResponse.json({ ok: true, deduped: true });
    return NextResponse.json({ ok: true, khoaDuAn, maDuAn, soDong: rows.length, nhanLuc });
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
    webhook: "tien-do-thiet-ke-chi-tiet",
    huongDan: "POST sự kiện tien_do.chia_se ký HMAC-SHA256 (x-webhook-signature, x-webhook-timestamp) bằng WEBHOOK_SECRET_DT_PTK",
    daCauHinhSecret: !!process.env[TEN_BIEN_SECRET],
  });
}
