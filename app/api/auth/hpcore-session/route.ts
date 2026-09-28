import { NextRequest, NextResponse } from "next/server";
import { verifyHpcore, fetchCentralRole, fetchCentralAvatar, fetchCentralFullName, parseCookieHeader, SSO_COOKIE_NAME } from "@/src/lib/hpcore";
import { getAdminAuth, getAdminDb } from "@/src/lib/firebase-admin";
import { CHUC_VU_BY_ROLE, tinhChucVuMoi, type Role } from "@/src/lib/phanQuyenLevel";

// VIEWER = Level 4 (chị Trâm chốt 26/07/2026). Role/CHUC_VU_BY_ROLE nay khai chung ở
// src/lib/phanQuyenLevel.ts (dùng chung với route đổi level app/api/phan-quyen/level) — phải có
// VIEWER, nếu không App Tổng gán quyền VIEWER thì route này coi là không hợp lệ và chặn (403).

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
// Từ 28/09/2026: chức vụ đi theo level mặc định khi level đổi — xem tinhChucVuMoi và ghi chú
// "NGUỒN QUYỀN" bên dưới.
// (Bảng CHUC_VU_BY_ROLE: xem src/lib/phanQuyenLevel.ts.)

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

    // ===== NGUỒN QUYỀN: APP TỔNG LÀ NGUỒN DUY NHẤT =====
    // SỬA 28/09/2026 theo demo phan-quyen-theo-app-tong (Sếp duyệt), ĐẢO quyết định 17/08/2026.
    // Demo: tong-quan-demo/HPCons-DauThau/phan-quyen-theo-app-tong-2026-09-28/index.html
    //
    // Lịch sử: 17/08/2026 chị Trâm chốt "app đấu thầu giữ bảng quyền riêng" — hồ sơ ĐÃ CÓ thì giữ
    // nguyên `role` của app, App Tổng không ghi đè. Hệ quả thật (28/09/2026): Sếp cấp "Phòng Đấu
    // Thầu" Level 1 ở App Tổng mà vào app vẫn là Level 4, còn người đã hạ ở App Tổng vẫn giữ Level 1.
    //
    // NAY:
    //   · `role` LUÔN = level App Tổng (app_permissions/{uid}.dauthau) ở MỖI LẦN đăng nhập.
    //   · Trưởng phòng vẫn nâng/hạ Level 2/3/4 trong "Đội ngũ & KPI", nhưng thay đổi đi qua route máy
    //     chủ app/api/phan-quyen/level và được ghi THẲNG về App Tổng — nên đăng nhập lại không mất.
    //   · `chucVu`: chức vụ cũ trống hoặc đúng bằng mặc định của level cũ → đổi sang mặc định của
    //     level mới; chức vụ Trưởng phòng đã tự đặt khác mặc định (vd "Phó phòng") → GIỮ NGUYÊN.
    //   · Chưa phân quyền ở App Tổng → 403 như cũ (đã kiểm ở trên).
    const role: Role = centralRole;
    const chucVu: string = cu ? tinhChucVuMoi(cu.role, cu.chucVu, centralRole) : CHUC_VU_BY_ROLE[centralRole];

    // HỌ TÊN: KHÁC role/chucVu ở trên — Sếp chốt 27/08/2026 (cùng đợt đổi "Thêm tài khoản
    // nhân sự mới" sang chọn người thật từ App Tổng): họ tên là DANH TÍNH, luôn đồng bộ SỐNG
    // từ App Tổng ở MỖI LẦN đăng nhập, giống hệt avatar bên dưới — không còn giữ nguyên giá
    // trị cũ nữa (đảo ngược quyết định 17/08/2026 trước đây, vốn coi hoTen như role/chucVu để
    // bảo vệ chỉnh sửa tay). Lý do: nhiều hồ sơ vẫn kẹt tên xấu (vd "loc nguyen") vì tên đó
    // KHÁC email nên không rơi vào diện "lỗi rõ ràng" của cơ chế tự sửa cũ — Sếp muốn App Tổng
    // là nguồn DUY NHẤT cho tên/avatar, Trưởng phòng không còn tự gõ tay sửa tên ở đây nữa.
    const hoTen: string = centralFullName || identity.fullName || identity.email;

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
