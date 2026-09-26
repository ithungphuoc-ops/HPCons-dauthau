import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { verifyHpcore, fetchCentralRole, parseCookieHeader, SSO_COOKIE_NAME } from "@/src/lib/hpcore";
import { getAdminDb } from "@/src/lib/firebase-admin";
import { createEvent, signWebhookEvent } from "@/src/lib/webhookHmac";
import { chuanHoaMaDuAn, laMaPhongDauThau } from "@/src/lib/maPhongBan";

export const dynamic = "force-dynamic";
// Lần nạp đầu (Trưởng phòng bấm "Đồng bộ lại" khi mới bật liên kết) có thể gửi vài chục dự án,
// mỗi lượt chờ App Thiết kế tối đa 8 giây — không nới thì hết giờ mặc định của Vercel giữa chừng.
export const maxDuration = 60;

/**
 * CHIỀU 2 — ĐẤU THẦU GỬI DỰ ÁN SANG APP THIẾT KẾ (OpenSpec change `lien-ket-thiet-ke-dau-thau`,
 * Sếp duyệt 26/09/2026)
 *
 * App Thiết kế cần biết mã dự án Phòng Đấu thầu để Trưởng nhóm Thiết kế chọn đúng mã khi tạo dự án
 * — có mã chung thì chiều ngược lại (Share tiến độ) mới ghép được.
 *
 * ===== AI GỌI =====
 *  (a) Trình duyệt, tự động sau khi đẩy `projects` lên Firestore thành công (gom nhịp 5 giây).
 *  (b) Nút "Đồng bộ lại sang Thiết kế" của Trưởng phòng ở tab Liên kết phòng ban.
 * Cả hai gọi CÙNG route này; nhờ dấu vân tay nên gọi bao nhiêu lần cũng chỉ gửi cái thật sự đổi,
 * và dự án lần trước gửi lỗi (dấu chưa được ghi) tự được gửi lại.
 *
 * ===== VÌ SAO MÁY CHỦ TỰ ĐỌC `projects` =====
 * Không nhận danh sách dự án từ trình duyệt: secret ký không được xuống trình duyệt, và bản trong
 * trình duyệt có thể cũ/sai. Route tự đọc bằng Admin SDK — đúng thứ vừa được lưu.
 *
 * ===== GỬI GÌ =====
 * Chỉ bản ghi `loaiBanGhi === "DU_AN"` có mã ô 1 đạt luật `YY10xx-HPCS` (src/lib/maPhongBan.ts),
 * và CHỈ 3 trường (+ khoá): không giá, không nhân sự, không công việc con (Sếp chốt phạm vi).
 * Hồ sơ cũ không có `loaiBanGhi` là CONG_VIEC → không gửi.
 * Khoá là ID tài liệu Firestore, KHÔNG phải mã: mã gõ tay nên đổi được — dùng mã làm khoá thì đổi
 * mã là bên Thiết kế đẻ dòng trùng (bài học PKD 17/07/2026).
 *
 * ===== KHÔNG TỰ XOÁ BÊN THIẾT KẾ =====
 * Dự án đổi mã ra khỏi dạng YY10xx hoặc bị xoá bên này: bản đã gửi giữ nguyên bên kia (Sếp chốt).
 */

const COLLECTION_PROJECTS = "projects";
const COLLECTION_LIEN_KET = "lien_ket_thiet_ke";
const EVENT_TYPE = "du_an.cap_nhat";
const SOURCE_APP = "dau_thau";
const THOI_GIAN_CHO_MS = 8000;
// Gửi song song có giới hạn: lần nạp đầu vài chục dự án gửi tuần tự 8s/cái là quá giờ, mà bắn cả
// loạt cùng lúc thì dồn cổng nhận bên Thiết kế.
const SO_LUONG_SONG_SONG = 5;

type DuLieuDuAn = {
  externalId: string;
  projectCode: string;
  projectName: string;
  location: string;
};

type BanGhiLienKet = {
  dauVanTay?: string;
  trangThai?: "da_gui" | "loi";
  loi?: string | null;
  guiLuc?: string;
  projectCode?: string;
};

const chu = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** Vị trí: `diaChi`; trống thì ghép "khuCongNghiep, tinhThanh", bỏ phần rỗng (mặc định design.md). */
const viTriCua = (p: Record<string, unknown>): string => {
  const diaChi = chu(p.diaChi);
  if (diaChi) return diaChi;
  return [chu(p.khuCongNghiep), chu(p.tinhThanh)].filter(Boolean).join(", ");
};

/**
 * Dấu vân tay của ĐÚNG 3 trường gửi đi — không băm cả bản ghi, để sửa tiến độ/giá/nhân sự của dự
 * án không làm bắn sự kiện sang Thiết kế (bên đó không nhận những trường ấy).
 */
const dauVanTayCua = (d: DuLieuDuAn): string =>
  createHash("sha256").update(JSON.stringify([d.projectCode, d.projectName, d.location])).digest("hex");

/** Gửi 1 dự án. Trả `null` khi App Thiết kế nhận (2xx), ngược lại trả câu lỗi để ghi lại. */
const guiMotDuAn = async (url: string, secret: string, d: DuLieuDuAn): Promise<string | null> => {
  const signed = signWebhookEvent(createEvent(EVENT_TYPE, SOURCE_APP, d), secret);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: signed.headers,
      body: signed.body,
      cache: "no-store",
      signal: AbortSignal.timeout(THOI_GIAN_CHO_MS),
    });
    if (res.ok) return null;
    const noiDung = (await res.text().catch(() => "")).slice(0, 300);
    return `App Thiết kế trả lỗi ${res.status}${noiDung ? `: ${noiDung}` : ""}`;
  } catch (e) {
    return `Không gọi được App Thiết kế (${e instanceof Error ? e.message : "lỗi mạng"})`;
  }
};

export async function POST(req: NextRequest) {
  // Cùng cơ chế các route UI khác (/api/tien-do-thiet-ke, /api/staff-directory): phiên App Tổng
  // (cookie `session`) + đã được cấp quyền vào app đấu thầu.
  const cookie = parseCookieHeader(req.headers.get("cookie"), SSO_COOKIE_NAME);
  const identity = await verifyHpcore(cookie);
  if (!identity) {
    return NextResponse.json({ ok: false, error: "NO_HPCORE_SESSION" }, { status: 401 });
  }
  const role = await fetchCentralRole(identity.uid);
  if (!role) {
    return NextResponse.json({ ok: false, error: "NO_APP_PERMISSION" }, { status: 403 });
  }

  const url = process.env.THIET_KE_WEBHOOK_URL;
  const secret = process.env.WEBHOOK_SECRET_DT_PTK;
  if (!url || !secret) {
    // KHÔNG phải lỗi: chưa bật liên kết thì việc lưu dự án vẫn phải chạy bình thường. Cũng là
    // đường lùi khẩn cấp — gỡ THIET_KE_WEBHOOK_URL là tắt chiều gửi mà không đụng code.
    return NextResponse.json({
      ok: true,
      chuaCauHinh: true,
      thongBao: "Chưa cấu hình THIET_KE_WEBHOOK_URL / WEBHOOK_SECRET_DT_PTK — chưa gửi gì sang App Thiết kế.",
      daGui: 0, khongDoi: 0, boQua: 0, loi: 0,
    });
  }

  try {
    const db = getAdminDb();
    const snap = await db.collection(COLLECTION_PROJECTS).get();

    const canGui: DuLieuDuAn[] = [];
    let boQua = 0;
    for (const doc of snap.docs) {
      const p = doc.data() as Record<string, unknown>;
      // Công việc con / hồ sơ cũ không có loaiBanGhi: không gửi, và không đếm vào "bỏ qua" — số
      // đó hàng trăm, đếm vào chỉ làm nhiễu tổng kết Trưởng phòng đọc.
      if (p.loaiBanGhi !== "DU_AN") continue;
      if (!laMaPhongDauThau(p.projectId)) { boQua += 1; continue; }
      const projectName = chu(p.tenDuAn);
      // Cổng nhận bên Thiết kế bắt buộc projectName (thiếu → 400). Gửi đi chỉ để nhận lỗi rồi lần
      // lưu nào cũng gửi lại vô ích, nên coi là "bỏ qua" cho tới khi hồ sơ có tên.
      if (!projectName) { boQua += 1; continue; }
      canGui.push({
        externalId: doc.id,
        projectCode: chuanHoaMaDuAn(p.projectId),
        projectName,
        location: viTriCua(p),
      });
    }

    // Đọc dấu cũ của đúng các dự án đạt luật trong MỘT lượt getAll (không đọc cả collection).
    const refs = canGui.map((d) => db.collection(COLLECTION_LIEN_KET).doc(d.externalId));
    const cuSnaps = refs.length ? await db.getAll(...refs) : [];
    const dauCu = new Map<string, BanGhiLienKet>();
    cuSnaps.forEach((s) => { if (s.exists) dauCu.set(s.id, s.data() as BanGhiLienKet); });

    const doi: Array<{ d: DuLieuDuAn; dau: string }> = [];
    let khongDoi = 0;
    for (const d of canGui) {
      const dau = dauVanTayCua(d);
      if (dauCu.get(d.externalId)?.dauVanTay === dau) khongDoi += 1;
      else doi.push({ d, dau });
    }

    let daGui = 0;
    const chiTietLoi: Array<{ projectCode: string; loi: string }> = [];
    for (let i = 0; i < doi.length; i += SO_LUONG_SONG_SONG) {
      const lo = doi.slice(i, i + SO_LUONG_SONG_SONG);
      const ketQua = await Promise.all(lo.map(({ d }) => guiMotDuAn(url, secret, d)));
      const batch = db.batch();
      const guiLuc = new Date().toISOString();
      lo.forEach(({ d, dau }, k) => {
        const ref = db.collection(COLLECTION_LIEN_KET).doc(d.externalId);
        const loi = ketQua[k];
        if (!loi) {
          daGui += 1;
          batch.set(ref, { dauVanTay: dau, trangThai: "da_gui", loi: null, guiLuc, projectCode: d.projectCode }, { merge: true });
        } else {
          // Lỗi thì KHÔNG cập nhật dấu vân tay — lần gọi sau thấy dấu vẫn khác và tự gửi lại.
          chiTietLoi.push({ projectCode: d.projectCode, loi });
          batch.set(ref, { trangThai: "loi", loi, guiLuc, projectCode: d.projectCode }, { merge: true });
        }
      });
      await batch.commit();
    }

    return NextResponse.json({ ok: true, daGui, khongDoi, boQua, loi: chiTietLoi.length, chiTietLoi });
  } catch (e) {
    return NextResponse.json(
      { ok: false, loi: `Lỗi đồng bộ: ${e instanceof Error ? e.message : "không rõ"}` },
      { status: 500 },
    );
  }
}
