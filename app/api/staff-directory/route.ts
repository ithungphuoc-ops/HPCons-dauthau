import { NextRequest, NextResponse } from "next/server";
import { verifyHpcore, getHpcoreDb, SSO_COOKIE_NAME } from "@/src/lib/hpcore";
import { getAdminDb } from "@/src/lib/firebase-admin";

function parseCookie(req: NextRequest, name: string): string | undefined {
  const header = req.headers.get("cookie") ?? "";
  return header
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

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
  const cookie = parseCookie(req, SSO_COOKIE_NAME);
  const identity = await verifyHpcore(cookie);
  if (!identity) {
    return NextResponse.json({ error: "NO_HPCORE_SESSION" }, { status: 401 });
  }

  try {
    const [usersSnap, staffSnap] = await Promise.all([
      getHpcoreDb().collection("users").where("isActive", "==", true).get(),
      getAdminDb().collection("staff").get(),
    ]);
    const daCoHoSo = new Set(staffSnap.docs.map((d) => d.id));

    const directory = usersSnap.docs
      .filter((d) => !daCoHoSo.has(d.id))
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
