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

// ignoreUndefinedProperties: webhook nhận dữ liệu từ 2 app khác (App Thông tin dự án, App Thiết
// kế) — payload thiếu trường tuỳ chọn thì hàm chuẩn hoá vẫn tạo key giá trị `undefined`. Mặc định
// Firestore từ chối `undefined` (kể cả lồng trong mảng hangMuc), nên nếu tắt cờ này 1 bản ghi lỗi
// giữa danh sách có thể làm hỏng cả lô ghi dở (các batch trước đã commit vẫn giữ nguyên, phát hiện
// khi rà PR #11 — CodeRabbit 21/09/2026). Chỉ cần đặt 1 lần, trước request Firestore đầu tiên.
let daDatCauHinhDb = false;
export function getAdminDb() {
  const db = getFirestore(getAdminApp());
  if (!daDatCauHinhDb) {
    db.settings({ ignoreUndefinedProperties: true });
    daDatCauHinhDb = true;
  }
  return db;
}
