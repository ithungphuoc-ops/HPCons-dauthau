import { NextRequest, NextResponse } from "next/server";
import { verifyHpcore, fetchCentralRole, fetchCentralAvatar, fetchCentralFullName, parseCookieHeader, SSO_COOKIE_NAME } from "@/src/lib/hpcore";
import { getAdminAuth, getAdminDb } from "@/src/lib/firebase-admin";

// VIEWER = Level 4 (chị Trâm chốt 26/07/2026). Phải khai ở đây, nếu không App Tổng gán quyền
// VIEWER thì route này coi là không hợp lệ và chặn đăng nhập (403).
type Role = "BOOD" | "MANAGER" | "STAFF" | "VIEWER";

// ===== CHỨC VỤ MẶC ĐỊNH KHI TẠO HỒ SƠ NHÂN SỰ TỪ SSO =====
// LỖI ĐÃ SỬA 17/08/2026 (chị Trâm báo, kèm ảnh màn "Đội ngũ & KPI"):
// BOOD trước đây ghi thành "Ban giám đốc", nên MỌI người được App Tổng cấp quyền Level 1 —
// Trưởng phòng, Phó phòng, cả tài khoản IT — đều hiện là "BAN GIÁM ĐỐC". Chính chị Trâm
// (Trưởng phòng) cũng bị ghi sai thành Ban giám đốc.
//
// Thang Level chị Trâm chốt 17/08/2026:
//   L1 = Trưởng phòng / Phó phòng · L2 = Quản lý · L3 = Nhân viên · L4 = Ban giám đốc.
// Nên BOOD → "Trưởng phòng" và VIEWER → "Ban giám đốc".
//
// LƯU Ý: đây chỉ là chức vụ MẶC ĐỊNH lúc tạo hồ sơ. Trưởng phòng vẫn sửa lại được trong
// "Đội ngũ & KPI" (vd đổi thành "Phó phòng"), và `merge: true` bên dưới không ghi đè... —
// xem ghi chú ở chỗ staffRef.set.
const CHUC_VU_BY_ROLE: Record<Role, string> = {
  BOOD: "Trưởng phòng",
  MANAGER: "Quản lý",
  STAFF: "Chuyên viên đấu thầu",
  VIEWER: "Ban giám đốc",
};

// Cầu nối SSO: verify phiên App Tổng (account.hpcore.vn) → mint Custom Token cho
// project Firebase RIÊNG của app đấu thầu → upsert hồ sơ nhân sự với vai trò do
// App Tổng gán tập trung (app_permissions/{uid}.dauthau). Client sau đó tự
// signInWithCustomToken() rồi đọc Firestore staff/{uid} qua subscribeCollection đã có sẵn.
export async function GET(req: NextRequest) {
  const cookie = parseCookieHeader(req.headers.get("cookie"), SSO_COOKIE_NAME);
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

    // Trước đây 6 lệnh gọi mạng chạy TUẦN TỰ (role → tạo/cập nhật Auth user → đọc staff →
    // avatar → ghi staff → mint token) — mỗi lượt cộng dồn khiến đăng nhập chậm rõ rệt
    // (góp ý Trâm 14/08: "xác thực đăng nhập vào app lâu lắm"). Gộp các bước ĐỘC LẬP với
    // nhau chạy song song bằng Promise.all — chỉ còn 3 lượt round-trip nối tiếp thay vì 6.
    const [centralRole, centralAvatar, centralFullName] = await Promise.all([
      fetchCentralRole(identity.uid) as Promise<Role | null>,
      fetchCentralAvatar(identity.uid),
      fetchCentralFullName(identity.uid),
    ]);
    // App Tổng vẫn là CỬA VÀO: chưa được phân quyền ở "Quản lý ứng dụng" (account.hpcore.vn)
    // thì từ chối thẳng, không tạo Auth user / staff doc / token.
    if (!centralRole || !(centralRole in CHUC_VU_BY_ROLE)) {
      return NextResponse.json({ error: "NOT_AUTHORIZED" }, { status: 403 });
    }

    const ensureAuthUser = adminAuth
      .updateUser(identity.uid, { email: identity.email, emailVerified: true })
      .catch(() =>
        adminAuth
          .createUser({ uid: identity.uid, email: identity.email, emailVerified: true })
          .catch(() => {})
      );

    const staffRef = adminDb.collection("staff").doc(identity.uid);
    // updateUser/createUser (Auth) và đọc staff doc (Firestore) không phụ thuộc nhau — chạy song song.
    const [, existing] = await Promise.all([ensureAuthUser, staffRef.get()]);
    const cu = existing.data();

    // ===== NGUỒN QUYỀN: BẢNG NHÂN SỰ CỦA APP ĐẤU THẦU (chị Trâm chốt hướng 2 — 17/08/2026) =====
    // "App đấu thầu giữ bảng quyền riêng, App Tổng chỉ lo đăng nhập."
    //
    // TRƯỚC ĐÂY route này ghi đè `role` và `chucVu` bằng giá trị của App Tổng ở MỖI LẦN đăng nhập.
    // Hậu quả: Trưởng phòng sửa lại quyền/chức vụ trong "Đội ngũ & KPI" xong, người đó đăng nhập
    // lại là mất hết — đúng điểm "CÒN TREO" ghi trong BAN-GIAO-2026-07-27.md.
    //
    // NAY: App Tổng chỉ quyết ĐƯỢC VÀO HAY KHÔNG (đã kiểm ở trên, chưa phân quyền thì 403).
    // Còn LEVEL và CHỨC VỤ thì:
    //   · Hồ sơ ĐÃ CÓ  → giữ nguyên giá trị của app đấu thầu, App Tổng không ghi đè.
    //   · Hồ sơ MỚI    → lấy giá trị App Tổng làm mức khởi đầu, sau đó Trưởng phòng tự chỉnh.
    //
    // Đánh đổi đã báo và chị Trâm chấp nhận: quyền ở hai app có thể lệch nhau. Muốn thu quyền
    // của ai thì bỏ phân quyền app này bên account.hpcore.vn (họ sẽ bị 403 ngay lần đăng nhập sau).
    const role: Role = (cu?.role as Role) || centralRole;
    const chucVu: string = cu?.chucVu || CHUC_VU_BY_ROLE[centralRole];

    // HỌ TÊN: cùng nguyên tắc "hồ sơ đã có thì KHÔNG ghi đè" như role/chucVu ở trên (chị Trâm
    // chốt 17/08/2026, lý do y hệt: Trưởng phòng sửa tay trong "Đội ngũ & KPI" xong, người đó
    // đăng nhập lại là mất — StaffEditModal.tsx CÓ ô sửa Họ tên, nên hoTen cũng cần được bảo
    // vệ như vậy (agent review PR#4 phát hiện, 26/08/2026).
    //
    // NHƯNG khác role/chucVu: hoTen ĐANG CÓ những bản ghi SAI thật (rơi về đúng email — chính
    // là lỗi chị Trâm báo 24/08/2026) cần được TỰ SỬA ở lần đăng nhập kế tiếp, không phải giữ
    // nguyên mãi mãi. Một họ tên thật không bao giờ trùng y hệt địa chỉ email của người đó —
    // nên dùng chính dấu hiệu "hoTen cũ === email" để phân biệt "lỗi cũ cần tự sửa" với "Trưởng
    // phòng đã chỉnh tay thật, phải giữ nguyên". So với CẢ email hiện tại LẪN email đã lưu lần
    // trước (cu?.email — SSO đổi email hiếm khi xảy ra nhưng nếu có, hoTen cũ có thể đang trùng
    // email CŨ chứ không phải email hiện tại; so 1 chiều sẽ bỏ sót, không tự sửa được nữa —
    // CodeRabbit góp ý vòng 2, PR#4).
    const hoTenCu = cu?.hoTen as string | undefined;
    const emailCu = typeof cu?.email === "string" ? cu.email : undefined;
    const hoTenCuLaLoiCu = !hoTenCu || hoTenCu === identity.email || (!!emailCu && hoTenCu === emailCu);
    const hoTen: string = hoTenCuLaLoiCu
      ? (centralFullName || identity.fullName || identity.email)
      : hoTenCu;

    // Avatar: ưu tiên ảnh thật từ hồ sơ App Tổng (account.hpcore.vn/profile) — đã lấy song
    // song ở bước fetchCentralAvatar bên trên, đổi avatar bên đó thì app này cũng cập nhật
    // theo ngay lần sau. Chỉ giữ ảnh local cũ khi App Tổng chưa có avatar nào. Ghi staff doc
    // và mint custom token cũng không phụ thuộc nhau — chạy song song.
    const [, token] = await Promise.all([
      staffRef.set(
        {
          id: identity.uid,
          hoTen,
          chucVu,
          avatar: centralAvatar || cu?.avatar || "",
          kpiDiem: cu?.kpiDiem ?? 0,
          soDuAnDangLam: cu?.soDuAnDangLam ?? 0,
          tiLeDungHan: cu?.tiLeDungHan ?? 100,
          email: identity.email,
          role,
          mustChangePassword: false,
        },
        { merge: true }
      ),
      adminAuth.createCustomToken(identity.uid),
    ]);
    return NextResponse.json({ token });
  } catch (e: any) {
    console.error("[hpcore-session] Lỗi cấp Custom Token:", e);
    return NextResponse.json({ error: "ADMIN_SDK_NOT_CONFIGURED", detail: e.message }, { status: 500 });
  }
}
