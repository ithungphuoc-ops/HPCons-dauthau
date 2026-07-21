import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, getDocs, onSnapshot, writeBatch } from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';
import { getAuth, onAuthStateChanged, signInWithCustomToken, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';

// Cấu hình Firebase của dự án (web config — không phải bí mật, an toàn khi nằm trong code).
// Project "hpcons-dauthau" — do Sếp tự tạo và quản lý (project cũ "app-bao-cao-tien-do-du-an"
// không thuộc quyền quản lý của Sếp nên đã chuyển hẳn sang project này).
const firebaseConfig = {
  apiKey: 'AIzaSyDqvfIwBIC1Cnm5DNVbgJk2apn-SE1pLLg',
  authDomain: 'hpcons-dauthau.firebaseapp.com',
  projectId: 'hpcons-dauthau',
  storageBucket: 'hpcons-dauthau.firebasestorage.app',
  messagingSenderId: '232555333681',
  appId: '1:232555333681:web:a91c5fcd137035c50c6d10',
};

export const fbApp = initializeApp(firebaseConfig);
export const fsDb = getFirestore(fbApp);
export const fbAuth = getAuth(fbApp);

// ===== Xác thực Firebase (Email/Password) =====
// Tài khoản Firebase dùng "email kỹ thuật" suy ra từ tên đăng nhập — người dùng không cần biết.
export const AUTH_EMAIL_DOMAIN = '@hpcons-erp.app';
export const authEmailFor = (username: string): string =>
  username.trim().toLowerCase().replace(/\s+/g, '') + AUTH_EMAIL_DOMAIN;

/** Lắng nghe trạng thái đăng nhập Firebase (đăng nhập/đăng xuất, kể cả phiên lưu sẵn). */
export const watchAuth = (cb: (user: User | null) => void): Unsubscribe => onAuthStateChanged(fbAuth, cb);

/** Đăng nhập bằng Custom Token do cầu nối SSO App Tổng (/api/auth/hpcore-session) cấp. */
export const signInWithHpcoreToken = (token: string): Promise<void> =>
  signInWithCustomToken(fbAuth, token).then(() => undefined);

/** Đăng xuất khỏi Firebase Auth — dùng khi rời app, phiên đăng nhập thật nằm ở App Tổng. */
export const signOutFb = (): Promise<void> => signOut(fbAuth);

// Firestore không nhận giá trị `undefined` — làm sạch object trước khi ghi
const sanitize = <T,>(item: T): T => JSON.parse(JSON.stringify(item));

/**
 * Ghi TOÀN BỘ danh sách bản ghi lên một collection (ghi đè theo id, xóa doc không còn trong danh sách).
 * Dùng cho mô hình đồng bộ cả mảng như app đang làm với db.json/staff.json.
 */
export async function pushCollection<T extends { id: string }>(colName: string, items: T[]): Promise<void> {
  const colRef = collection(fsDb, colName);
  const existing = await getDocs(colRef);
  const keep = new Set(items.map((i) => i.id));
  const batch = writeBatch(fsDb);
  existing.docs.forEach((d) => {
    if (!keep.has(d.id)) batch.delete(d.ref);
  });
  items.forEach((i) => batch.set(doc(fsDb, colName, i.id), sanitize(i)));
  await batch.commit();
}

/**
 * Lắng nghe realtime một collection. Trả về hàm hủy đăng ký.
 * onData nhận (items, isEmpty) — isEmpty=true khi collection chưa có dữ liệu trên cloud.
 */
export function subscribeCollection<T>(colName: string, onData: (items: T[], isEmpty: boolean) => void): Unsubscribe {
  return onSnapshot(
    collection(fsDb, colName),
    (snap) => {
      const items = snap.docs.map((d) => d.data() as T);
      onData(items, snap.empty);
    },
    (err) => {
      console.error(`[Firebase] Lỗi lắng nghe collection "${colName}" (kiểm tra Rules trên Firebase Console):`, err.message);
    }
  );
}

/** Thu nhỏ ảnh đại diện về tối đa 256px (JPEG) để doc Firestore luôn dưới giới hạn 1MB */
export function downscaleImage(dataUrl: string, maxSize = 256): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(dataUrl);
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
