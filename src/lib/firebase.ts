import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, getDocs, onSnapshot, writeBatch } from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import type { User } from 'firebase/auth';

// Cấu hình Firebase của dự án (web config — không phải bí mật, an toàn khi nằm trong code)
const firebaseConfig = {
  apiKey: 'AIzaSyAS-TMwQ_45Nx226sFOSDrt0fuq7-q1mbc',
  authDomain: 'app-bao-cao-tien-do-du-an.firebaseapp.com',
  projectId: 'app-bao-cao-tien-do-du-an',
  storageBucket: 'app-bao-cao-tien-do-du-an.firebasestorage.app',
  messagingSenderId: '204087218028',
  appId: '1:204087218028:web:0fb4d97143886f4401ad49',
  measurementId: 'G-LFD4H9YK3W',
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

/**
 * Bản dùng thử nội bộ chưa có màn đăng nhập — đăng nhập ẩn (anonymous) chạy ngầm
 * để Firestore Rules (yêu cầu request.auth != null) cho phép đọc/ghi dữ liệu.
 */
export const ensureAnonymousAuth = (): Promise<void> =>
  signInAnonymously(fbAuth).then(() => undefined).catch((e) => {
    console.error('[Firebase] Lỗi đăng nhập ẩn danh:', e);
  });

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
