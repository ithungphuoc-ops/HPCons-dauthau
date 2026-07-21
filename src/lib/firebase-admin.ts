import "server-only";

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// Admin SDK cho project RIÊNG của app đấu thầu (app-bao-cao-tien-do-du-an) —
// dùng để mint Custom Token và upsert hồ sơ nhân sự khi đăng nhập qua SSO.
// 3 biến tách trường (không gộp 1 JSON) — cùng quy ước với hpcons-portal/Task Manager.
function getAdminApp() {
  const existing = getApps().find((a) => a.name === "[DEFAULT]");
  if (existing) return existing;

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Thiếu FIREBASE_ADMIN_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY (service account project app-bao-cao-tien-do-du-an)."
    );
  }

  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

// Lazy — chỉ thực sự khởi tạo (và đòi hỏi biến môi trường) lúc route handler gọi đến,
// KHÔNG phải lúc module được import — nếu không, bước "collect page data" của
// `next build` sẽ luôn thất bại khi biến môi trường chưa được cấu hình.
export function getAdminAuth() {
  return getAuth(getAdminApp());
}
export function getAdminDb() {
  return getFirestore(getAdminApp());
}
