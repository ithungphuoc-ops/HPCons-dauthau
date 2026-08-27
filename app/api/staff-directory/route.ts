import { NextRequest, NextResponse } from "next/server";
import { verifyHpcore, fetchCentralRole, getHpcoreDb, parseCookieHeader, SSO_COOKIE_NAME } from "@/src/lib/hpcore";
import { getAdminDb } from "@/src/lib/firebase-admin";

/**
 * Danh bạ nhân sự để chọn khi "Thêm tài khoản nhân sự mới" (Đội Ngũ & KPI) — đọc
 * trực tiếp từ Firestore App Tổng (collection `users`, đang hoạt động), KHÔNG cho gõ
 * tay tên/mã như trước (Sếp chốt 27/08/2026: "Firebase này chỉ lưu dữ liệu không lưu
 * hồ sơ người dùng mà phải lấy hồ sơ người dùng từ app tổng và đồng bộ từ app tổng
 * qua"). Trả về `id` = uid App Tổng — dùng thẳng làm khoá tài liệu `staff/{id}`, TRÙNG
 * với khoá mà route SSO (`app/api/auth/hpcore-session`) sẽ dùng khi chính người đó tự
 * đăng nhập sau này — tránh tạo 2 hồ sơ cho cùng 1 người (bug thật: trước đây "Thêm tài
 * khoản nhân sự mới" tự sinh mã kiểu S009, khác hẳn uid App Tổng).
 *
 * Loại bỏ sẵn những người ĐÃ có hồ sơ trong app này (staff collection riêng) — không
 * cho chọn trùng người đã tồn tại.
 */
export async function GET(req: NextRequest) {
  const cookie = parseCookieHeader(req.headers.get("cookie"), SSO_COOKIE_NAME);
  const identity = await verifyHpcore(cookie);
  if (!identity) {
    return NextResponse.json({ error: "NO_HPCORE_SESSION" }, { status: 401 });
  }
  // Đọc danh bạ để lộ tên/email/phòng ban của 100+ nhân sự — phải là người ĐÃ được cấp
  // quyền vào app này (app_permissions/{uid}.dauthau), không chỉ cần có tài khoản
  // App Tổng bất kỳ. Đúng cơ chế route SSO đang dùng — thiếu bước này thì bất kỳ ai có
  // phiên hpcore hợp lệ (kể cả chưa từng vào app đấu thầu) cũng gọi thẳng URL lấy được
  // toàn bộ email nhân sự công ty (lỗ hổng thật, agent code-review phát hiện 27/08/2026).
  const role = await fetchCentralRole(identity.uid);
  if (!role) {
    return NextResponse.json({ error: "NOT_AUTHORIZED" }, { status: 403 });
  }

  try {
    const [usersSnap, staffSnap] = await Promise.all([
      getHpcoreDb().collection("users").where("isActive", "==", true).get(),
      getAdminDb().collection("staff").get(),
    ]);

    // Loại người ĐÃ có hồ sơ trong app này — khớp theo doc id (đúng cho hồ sơ tạo qua
    // luồng mới, id = uid App Tổng) VÀ theo email/username (phòng hờ hồ sơ CŨ tạo tay
    // trước PR này, id kiểu "S009" không phải uid nên không khớp theo id — CodeRabbit
    // góp ý thêm username ngoài email, 27/08/2026). Hồ sơ cũ tạo tay mà CHƯA từng có cả
    // email lẫn username lưu lại (chuyện thường gặp — trước đây "Thêm tài khoản" không
    // hỏi 2 trường này) vẫn có thể lọt qua bước loại; dọn sạch lịch sử cũ (gộp hồ sơ
    // trùng) là việc riêng, không nằm trong PR đổi giao diện này.
    const idsDaCo = new Set(staffSnap.docs.map((d) => d.id));
    const emailsDaCo = new Set(
      staffSnap.docs
        .map((d) => (d.data() as { email?: string }).email?.trim().toLowerCase())
        .filter((e): e is string => !!e)
    );
    const usernamesDaCo = new Set(
      staffSnap.docs
        .map((d) => (d.data() as { username?: string }).username?.trim().toLowerCase())
        .filter((u): u is string => !!u)
    );

    const directory = usersSnap.docs
      .filter((d) => {
        if (idsDaCo.has(d.id)) return false;
        const data = d.data() as { email?: string; username?: string };
        const email = data.email?.trim().toLowerCase();
        if (email && emailsDaCo.has(email)) return false;
        const username = data.username?.trim().toLowerCase();
        return !(username && usernamesDaCo.has(username));
      })
      .map((d) => {
        const u = d.data() as {
          fullName?: string; email?: string; username?: string | null;
          department?: string; title?: string;
        };
        const name = u.fullName?.trim() || u.email?.split("@")[0] || d.id;
        return {
          id: d.id,
          name,
          username: u.username || u.email?.split("@")[0] || d.id,
          email: u.email || null,
          dept: u.department || u.title || null,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "vi"));

    return NextResponse.json({ directory });
  } catch (e: any) {
    console.error("[staff-directory] Lỗi tải danh bạ App Tổng:", e);
    return NextResponse.json({ error: "LOI_TAI_DANH_BA", detail: e.message }, { status: 500 });
  }
}
