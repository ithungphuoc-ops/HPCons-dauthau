import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { verifyHpcore, fetchCentralRole, getHpcoreDb, parseCookieHeader, SSO_COOKIE_NAME } from "@/src/lib/hpcore";
import { getAdminDb } from "@/src/lib/firebase-admin";
import { NHAN_LEVEL, laRole, quyetDinhDoiLevel, tinhChucVuMoi, type Role } from "@/src/lib/phanQuyenLevel";

// ===== ĐỔI LEVEL NHÂN SỰ — GHI THẲNG VỀ APP TỔNG (Sếp duyệt demo 28/09/2026) =====
// Demo: tong-quan-demo/HPCons-DauThau/phan-quyen-theo-app-tong-2026-09-28/index.html
//
// App Tổng (`app_permissions/{uid}.dauthau`, project hpcons-portal) là NGUỒN DUY NHẤT của level.
// Trưởng phòng đổi level trong "Đội ngũ & KPI" → route này:
//   1. Xác thực cookie phiên App Tổng (verifyHpcore), như mọi route UI khác.
//   2. Trong MỘT transaction ở project App Tổng: đọc SỐNG (không qua cache 30s của
//      fetchCentralRole) level + cờ owner của người gọi và người đích, áp luật thuần
//      `quyetDinhDoiLevel` (src/lib/phanQuyenLevel.ts), rồi ghi `app_permissions/{uid}.dauthau`
//      và 1 dòng `activity_logs` (cùng collection "Nhật ký hoạt động" của App Tổng mà
//      reportActivity() phía trình duyệt đang ghi qua account.hpcore.vn/api/activity).
//      Transaction tự chạy lại nếu có người khác đổi cùng lúc → không ghi đè sai.
//   3. Cập nhật `staff/{uid}` (project Đấu thầu) role + chucVu theo luật tinhChucVuMoi, cũng trong
//      transaction (đọc lại hồ sơ mới nhất rồi mới ghi).

const APP_NAME_LOG = "HPC Đấu Thầu";

type DocOwner = { role?: unknown; fullName?: unknown; email?: unknown };

function loi(status: number, ma: string, message: string) {
  return NextResponse.json({ error: ma, message }, { status });
}

async function xacThuc(req: NextRequest) {
  const cookie = parseCookieHeader(req.headers.get("cookie"), SSO_COOKIE_NAME);
  return verifyHpcore(cookie);
}

/**
 * GET: danh sách uid là owner App Tổng — giao diện dùng để khoá ô level của tài khoản owner
 * (và mở quyền đổi cho owner đang xem). Chỉ người đã có quyền app Đấu thầu mới gọi được.
 */
export async function GET(req: NextRequest) {
  const identity = await xacThuc(req);
  if (!identity) return loi(401, "NO_HPCORE_SESSION", "Phiên đăng nhập App Tổng đã hết. Vui lòng đăng nhập lại.");
  const role = await fetchCentralRole(identity.uid);
  if (!role) return loi(403, "NOT_AUTHORIZED", "Bạn chưa được cấp quyền app Đấu thầu ở App Tổng.");
  try {
    const snap = await getHpcoreDb().collection("users").where("role", "==", "owner").get();
    return NextResponse.json({ ownerIds: snap.docs.map((d) => d.id) });
  } catch (e: any) {
    console.error("[phan-quyen/level] Lỗi đọc danh sách owner:", e);
    return loi(500, "LOI_DOC_OWNER", "Không đọc được danh sách owner từ App Tổng.");
  }
}

export async function POST(req: NextRequest) {
  const identity = await xacThuc(req);
  if (!identity) return loi(401, "NO_HPCORE_SESSION", "Phiên đăng nhập App Tổng đã hết. Vui lòng đăng nhập lại.");

  const body = await req.json().catch(() => null);
  const uidDich = typeof body?.uid === "string" ? body.uid.trim() : "";
  const levelMoi = body?.level;
  if (!uidDich || uidDich.includes("/")) return loi(400, "THIEU_NGUOI_DICH", "Thiếu hoặc sai mã nhân sự cần đổi level.");
  if (!laRole(levelMoi)) return loi(400, "LEVEL_KHONG_HOP_LE", "Level không hợp lệ.");

  const hpDb = getHpcoreDb();
  const permGoiRef = hpDb.collection("app_permissions").doc(identity.uid);
  const userGoiRef = hpDb.collection("users").doc(identity.uid);
  const permDichRef = hpDb.collection("app_permissions").doc(uidDich);
  const userDichRef = hpDb.collection("users").doc(uidDich);

  // ---- Bước 1: App Tổng (nguồn duy nhất) — đọc sống + ghi trong 1 transaction ----
  let ketQua: { levelCu: Role; levelMoi: Role; tenDich: string } | NextResponse;
  try {
    ketQua = await hpDb.runTransaction(async (tx) => {
      const [permGoi, userGoi, permDich, userDich] = await tx.getAll(permGoiRef, userGoiRef, permDichRef, userDichRef);
      const ug = (userGoi.data() ?? {}) as DocOwner;
      const ud = (userDich.data() ?? {}) as DocOwner;
      const levelGoi = permGoi.data()?.dauthau;
      const levelDich = permDich.data()?.dauthau;

      const qd = quyetDinhDoiLevel({
        nguoiGoiUid: identity.uid,
        nguoiGoiLevel: typeof levelGoi === "string" ? levelGoi : null,
        nguoiGoiLaOwner: ug.role === "owner",
        nguoiDichUid: uidDich,
        nguoiDichLevel: typeof levelDich === "string" ? levelDich : null,
        nguoiDichLaOwner: ud.role === "owner",
        levelMoi,
      });
      if (qd.duoc === false) return loi(qd.status, qd.ma, qd.loi);

      const tenGoi = (typeof ug.fullName === "string" && ug.fullName.trim()) || identity.fullName || identity.email;
      const tenDich = (typeof ud.fullName === "string" && ud.fullName.trim()) || (typeof ud.email === "string" ? ud.email : uidDich);

      if (qd.levelCu !== qd.levelMoi) {
        tx.set(permDichRef, { dauthau: qd.levelMoi }, { merge: true });
        tx.set(hpDb.collection("activity_logs").doc(), {
          actorUid: identity.uid,
          actorName: tenGoi,
          actorEmail: identity.email,
          action: "Đổi level nhân sự",
          entityType: "dauthau_level",
          entityId: uidDich,
          detail: `${tenGoi} đổi level app Đấu thầu của ${tenDich}: ${NHAN_LEVEL[qd.levelCu]} → ${NHAN_LEVEL[qd.levelMoi]} (ghi về App Tổng)`,
          appName: APP_NAME_LOG,
          levelCu: qd.levelCu,
          levelMoi: qd.levelMoi,
          createdAt: Timestamp.now(),
        });
      }
      return { levelCu: qd.levelCu, levelMoi: qd.levelMoi, tenDich };
    });
  } catch (e: any) {
    console.error("[phan-quyen/level] Lỗi ghi App Tổng:", e);
    return loi(500, "LOI_GHI_APP_TONG", "Không lưu được level về App Tổng. Chưa có gì thay đổi, vui lòng thử lại.");
  }
  if (ketQua instanceof NextResponse) return ketQua;
  const { levelCu, levelMoi: levelDaLuu, tenDich } = ketQua;

  // ---- Bước 2: hồ sơ staff/{uid} của app Đấu thầu — đọc lại rồi ghi trong transaction ----
  try {
    const adminDb = getAdminDb();
    const staffRef = adminDb.collection("staff").doc(uidDich);
    const kq = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(staffRef);
      if (!snap.exists) return { coHoSo: false, chucVu: null as string | null };
      const cu = snap.data() as { role?: string; chucVu?: string };
      const chucVu = tinhChucVuMoi(cu.role ?? levelCu, cu.chucVu, levelDaLuu);
      tx.set(staffRef, { role: levelDaLuu, chucVu }, { merge: true });
      return { coHoSo: true, chucVu };
    });
    return NextResponse.json({
      ok: true,
      uid: uidDich,
      tenDich,
      levelCu,
      levelMoi: levelDaLuu,
      role: levelDaLuu,
      chucVu: kq.chucVu,
      coHoSo: kq.coHoSo,
    });
  } catch (e: any) {
    // App Tổng đã lưu (nguồn duy nhất) — hồ sơ trong app sẽ tự khớp ở lần đăng nhập kế tiếp.
    console.error("[phan-quyen/level] Đã lưu App Tổng nhưng lỗi cập nhật staff:", e);
    return NextResponse.json(
      {
        error: "LOI_CAP_NHAT_HO_SO",
        message: "Đã lưu level về App Tổng, nhưng chưa cập nhật được hồ sơ trong app. Hồ sơ sẽ tự khớp khi người này đăng nhập lại.",
        daLuuAppTong: true,
        levelCu,
        levelMoi: levelDaLuu,
      },
      { status: 500 },
    );
  }
}
