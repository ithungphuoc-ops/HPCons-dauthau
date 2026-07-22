import { NextRequest, NextResponse } from "next/server";
import { verifyHpcore, fetchCentralRole, fetchCentralAvatar, SSO_COOKIE_NAME } from "@/src/lib/hpcore";
import { getAdminAuth, getAdminDb } from "@/src/lib/firebase-admin";

type Role = "BOOD" | "MANAGER" | "STAFF";

const CHUC_VU_BY_ROLE: Record<Role, string> = {
  BOOD: "Ban giám đốc",
  MANAGER: "Quản lý",
  STAFF: "Chuyên viên đấu thầu",
};

function parseCookie(req: NextRequest, name: string): string | undefined {
  const header = req.headers.get("cookie") ?? "";
  return header
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

// Cầu nối SSO: verify phiên App Tổng (account.hpcore.vn) → mint Custom Token cho
// project Firebase RIÊNG của app đấu thầu → upsert hồ sơ nhân sự với vai trò do
// App Tổng gán tập trung (app_permissions/{uid}.dauthau). Client sau đó tự
// signInWithCustomToken() rồi đọc Firestore staff/{uid} qua subscribeCollection đã có sẵn.
export async function GET(req: NextRequest) {
  const cookie = parseCookie(req, SSO_COOKIE_NAME);
  const identity = await verifyHpcore(cookie);
  if (!identity) {
    return NextResponse.json({ error: "NO_HPCORE_SESSION" }, { status: 401 });
  }

  // Bọc riêng phần cần Admin SDK của project DauThau — nếu FIREBASE_ADMIN_* chưa
  // được cấu hình (vd. đang chờ Sếp gửi file service account), trả lỗi rõ ràng
  // thay vì để crash không rõ nguyên nhân.
  try {
    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();

    const centralRole = (await fetchCentralRole(identity.uid)) as Role | null;
    // Chưa được Sếp phân quyền ở "Quản lý ứng dụng" (account.hpcore.vn) → KHÔNG tự cấp
    // quyền STAFF mặc định nữa, từ chối thẳng (không tạo Auth user/staff doc/token).
    if (!centralRole || !(centralRole in CHUC_VU_BY_ROLE)) {
      return NextResponse.json({ error: "NOT_AUTHORIZED" }, { status: 403 });
    }
    const role: Role = centralRole;

    try {
      await adminAuth.updateUser(identity.uid, { email: identity.email, emailVerified: true });
    } catch {
      await adminAuth
        .createUser({ uid: identity.uid, email: identity.email, emailVerified: true })
        .catch(() => {});
    }

    const staffRef = adminDb.collection("staff").doc(identity.uid);
    const existing = await staffRef.get();
    // Avatar: ưu tiên ảnh thật từ hồ sơ App Tổng (account.hpcore.vn/profile), đọc sống mỗi
    // lần đăng nhập — đổi avatar bên đó thì app này cũng cập nhật theo ngay lần sau, không
    // còn kẹt cứng ảnh cũ nữa. Chỉ giữ ảnh local cũ khi App Tổng chưa có avatar nào.
    const centralAvatar = await fetchCentralAvatar(identity.uid);
    await staffRef.set(
      {
        id: identity.uid,
        hoTen: identity.fullName || existing.data()?.hoTen || identity.email,
        chucVu: CHUC_VU_BY_ROLE[role],
        avatar: centralAvatar || existing.data()?.avatar || "",
        kpiDiem: existing.data()?.kpiDiem ?? 0,
        soDuAnDangLam: existing.data()?.soDuAnDangLam ?? 0,
        tiLeDungHan: existing.data()?.tiLeDungHan ?? 100,
        email: identity.email,
        role,
        mustChangePassword: false,
      },
      { merge: true }
    );

    const token = await adminAuth.createCustomToken(identity.uid);
    return NextResponse.json({ token });
  } catch (e: any) {
    console.error("[hpcore-session] Lỗi cấp Custom Token:", e);
    return NextResponse.json({ error: "ADMIN_SDK_NOT_CONFIGURED", detail: e.message }, { status: 500 });
  }
}
