import "server-only";

import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { unstable_cache } from "next/cache";

// Xác minh phiên đăng nhập App Tổng (account.hpcore.vn) — cùng pattern đã dùng
// cho pkd_crm-next / ITAsset / Task Manager. App instance đặt tên riêng "hpcore"
// để không đụng app Firebase mặc định (project riêng của DauThau).
const APP_NAME = "hpcore";
export const SSO_COOKIE_NAME = "session";

export const hpcoreLoginUrl = (returnTo: string): string =>
  `https://account.hpcore.vn/login?next=${encodeURIComponent(returnTo)}`;

/**
 * Đọc 1 cookie theo tên từ header `Cookie` thô — dùng chung cho mọi route cần verify
 * phiên SSO (trước đây copy-paste riêng ở từng route.ts, dễ lệch nhau khi sửa —
 * agent code-review phát hiện khi làm PR "Đội Ngũ & KPI đồng bộ App Tổng", 27/08/2026).
 * Nhận thẳng chuỗi header (không phụ thuộc kiểu NextRequest) để dùng được ở bất kỳ
 * route nào, kể cả ngoài Next.js App Router.
 */
export function parseCookieHeader(cookieHeader: string | null | undefined, name: string): string | undefined {
  return (cookieHeader ?? "")
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function loadCredential(): object {
  const raw = process.env.HPCORE_FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    throw new Error(
      "Thiếu HPCORE_FIREBASE_SERVICE_ACCOUNT (JSON service account project hpcons-portal)."
    );
  }
  return JSON.parse(raw);
}

function getHpcoreApp(): App {
  const existing = getApps().find((a) => a.name === APP_NAME);
  if (existing) return existing;
  return initializeApp(
    { credential: cert(loadCredential() as Parameters<typeof cert>[0]) },
    APP_NAME
  );
}

let hpcoreAuthCache: Auth | null = null;
let hpcoreDbCache: Firestore | null = null;

export function getHpcoreAuth(): Auth {
  return (hpcoreAuthCache ??= getAuth(getHpcoreApp()));
}

export function getHpcoreDb(): Firestore {
  return (hpcoreDbCache ??= getFirestore(getHpcoreApp()));
}

export interface HpcoreIdentity {
  uid: string;
  email: string;
  fullName?: string;
}

export async function verifyHpcore(
  cookie: string | undefined
): Promise<HpcoreIdentity | null> {
  if (!cookie) return null;
  try {
    const decoded = await getHpcoreAuth().verifySessionCookie(cookie, true);
    const email = (decoded.email ?? "").trim().toLowerCase();
    if (!email) return null;
    return { uid: decoded.uid, email, fullName: decoded.name as string | undefined };
  } catch {
    return null;
  }
}

// ⚠️ QUY ƯỚC HẠN MỨC FIRESTORE — ghi lại sau sự cố RESOURCE_EXHAUSTED thật ở app Kho công trình
// (QLK CTR) ngày 13/09/2026. Rà soát 14/09/2026 phát hiện 3 hàm đọc "hồ sơ đăng nhập" dưới đây
// (role/avatar/họ tên) chạy MỖI LẦN xác minh phiên SSO (tức mỗi F5/mở app), không cache — trong khi
// 6 app khác (App Tổng/Đề xuất/Quà tặng/Booking/ITAsset/Kho mới) đã thêm cache 30-60s cho đúng
// kiểu đọc này từ 21/08/2026, DauThau bị bỏ sót khỏi đợt đó. Cache 30s ở đây AN TOÀN không cần
// revalidateTag vì cả 2 collection (app_permissions, users) đều do App Tổng SỞ HỮU VÀ GHI —
// DauThau chỉ đọc, không có hàm ghi nào ở repo này cần thấy dữ liệu mới ngay lập tức.
export const fetchCentralRole = unstable_cache(
  async (uid: string): Promise<string | null> => {
    try {
      const snap = await getHpcoreDb().collection("app_permissions").doc(uid).get();
      const role = snap.data()?.dauthau;
      return typeof role === "string" ? role : null;
    } catch {
      return null;
    }
  },
  ["dauthau-central-role"],
  { revalidate: 30 },
);

/**
 * Avatar thật của người dùng, lấy trực tiếp từ hồ sơ App Tổng (users/{uid}.avatarUrl —
 * account.hpcore.vn/profile). Đọc sống mỗi lần SSO thay vì chỉ đồng bộ 1 lần lúc tạo tài
 * khoản, để đổi avatar bên App Tổng là các app con cũng thấy ngay trong lần đăng nhập kế tiếp.
 */
export const fetchCentralAvatar = unstable_cache(
  async (uid: string): Promise<string | null> => {
    try {
      const snap = await getHpcoreDb().collection("users").doc(uid).get();
      const url = snap.data()?.avatarUrl;
      return typeof url === "string" && url ? url : null;
    } catch {
      return null;
    }
  },
  ["dauthau-central-avatar"],
  { revalidate: 30 },
);

/**
 * Họ tên thật của người dùng, đọc SỐNG từ hồ sơ App Tổng (users/{uid}.fullName —
 * account.hpcore.vn/profile) — cùng nguồn/cách đọc với fetchCentralAvatar ở trên.
 *
 * Chị Trâm báo 24/08/2026: "Chưa đồng bộ được avatar - và họ tên của nhân sự ở trong app
 * với app tổng bên ngoài". Avatar vốn đã đọc sống đúng cách (hàm trên), nhưng HỌ TÊN trước
 * đây lại lấy từ claim `name` trong session cookie Firebase Auth (identity.fullName ở
 * route SSO) — claim này chỉ được set 1 lần lúc tạo tài khoản/đăng nhập lần đầu, KHÔNG tự
 * cập nhật khi người dùng đổi tên ở account.hpcore.vn/profile sau đó, nên vài người hiện
 * tên rỗng/lệch (rơi về email) dù đã có tên đầy đủ bên App Tổng — trong khi avatar của
 * chính họ lại đúng vì đọc sống. Nay họ tên cũng đọc sống giống avatar, cùng field
 * `fullName` mà base-request-app/lib/session.ts đã dùng đúng cho cùng collection này.
 */
export const fetchCentralFullName = unstable_cache(
  async (uid: string): Promise<string | null> => {
    try {
      const snap = await getHpcoreDb().collection("users").doc(uid).get();
      const name = snap.data()?.fullName;
      return typeof name === "string" && name.trim() ? name.trim() : null;
    } catch {
      return null;
    }
  },
  ["dauthau-central-fullname"],
  { revalidate: 30 },
);
