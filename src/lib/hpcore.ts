import "server-only";

import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

// Xác minh phiên đăng nhập App Tổng (account.hpcore.vn) — cùng pattern đã dùng
// cho pkd_crm-next / ITAsset / Task Manager. App instance đặt tên riêng "hpcore"
// để không đụng app Firebase mặc định (project riêng của DauThau).
const APP_NAME = "hpcore";
export const SSO_COOKIE_NAME = "session";

export const hpcoreLoginUrl = (returnTo: string): string =>
  `https://account.hpcore.vn/login?next=${encodeURIComponent(returnTo)}`;

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

/** Vai trò DauThau do App Tổng gán tập trung (app_permissions/{uid}.dauthau). */
export async function fetchCentralRole(uid: string): Promise<string | null> {
  try {
    const snap = await getHpcoreDb().collection("app_permissions").doc(uid).get();
    const role = snap.data()?.dauthau;
    return typeof role === "string" ? role : null;
  } catch {
    return null;
  }
}

/**
 * Avatar thật của người dùng, lấy trực tiếp từ hồ sơ App Tổng (users/{uid}.avatarUrl —
 * account.hpcore.vn/profile). Đọc sống mỗi lần SSO thay vì chỉ đồng bộ 1 lần lúc tạo tài
 * khoản, để đổi avatar bên App Tổng là các app con cũng thấy ngay trong lần đăng nhập kế tiếp.
 */
export async function fetchCentralAvatar(uid: string): Promise<string | null> {
  try {
    const snap = await getHpcoreDb().collection("users").doc(uid).get();
    const url = snap.data()?.avatarUrl;
    return typeof url === "string" && url ? url : null;
  } catch {
    return null;
  }
}
