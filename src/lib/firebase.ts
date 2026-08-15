import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, deleteDoc, getDocs, onSnapshot, writeBatch } from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithCustomToken, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';

// Cấu hình Firebase của dự án (web config — không phải bí mật, an toàn khi nằm trong code).
// Project "hpcons-dauthau" — do Sếp tự tạo và quản lý (project cũ "app-bao-cao-tien-do-du-an"
// không thuộc quyền quản lý của Sếp nên đã chuyển hẳn sang project này).
//
// ╔══════════════════════════════════════════════════════════════════════════════════════════╗
// ║ ⚠️ TRƯỚC KHI GỬI BẢN CHO IT / DEPLOY PRODUCTION: khối config dưới đây PHẢI là           ║
// ║    projectId: 'hpcons-dauthau'.                                                          ║
// ║                                                                                          ║
// ║ Config nằm CỨNG trong code (không đọc từ .env), nên mỗi lần thử trên project Firebase    ║
// ║ khác (project test) là phải sửa trực tiếp ở đây — và rất dễ quên đổi lại. Gửi IT bản     ║
// ║ đang trỏ project test thì app production chạy trên dữ liệu rỗng, còn dữ liệu thật của    ║
// ║ Phòng vẫn nằm ở hpcons-dauthau: cả phòng mở app ra là thấy trắng.                        ║
// ║                                                                                          ║
// ║ Kiểm 1 câu trước khi bàn giao:  grep -n "projectId" src/lib/firebase.ts                  ║
// ╚══════════════════════════════════════════════════════════════════════════════════════════╝
const configProduction = {
  apiKey: 'AIzaSyDqvfIwBIC1Cnm5DNVbgJk2apn-SE1pLLg',
  authDomain: 'hpcons-dauthau.firebaseapp.com',
  projectId: 'hpcons-dauthau',
  storageBucket: 'hpcons-dauthau.firebasestorage.app',
  messagingSenderId: '232555333681',
  appId: '1:232555333681:web:a91c5fcd137035c50c6d10',
};

// Cho phép TRỎ SANG PROJECT KHÁC bằng 1 biến môi trường duy nhất, dùng cho bản DEMO trên web
// (project Firebase THỬ) mà không phải sửa code. KHÔNG khai biến này thì chạy y như cũ với
// project thật ở trên — nên IT triển khai production không cần làm gì thêm.
// Cách khai (Vercel → Environment Variables), dán JSON một dòng:
//   NEXT_PUBLIC_FIREBASE_CONFIG={"apiKey":"...","authDomain":"...","projectId":"...","storageBucket":"...","messagingSenderId":"...","appId":"..."}
const docConfigTuEnv = (): typeof configProduction | null => {
  const raw = process.env.NEXT_PUBLIC_FIREBASE_CONFIG;
  if (!raw) return null;
  try {
    const c = JSON.parse(raw);
    // Thiếu 1 trong 3 trường cốt lõi là config hỏng → thà dùng production còn hơn chạy nửa vời
    if (!c?.apiKey || !c?.projectId || !c?.appId) {
      console.error('[Firebase] NEXT_PUBLIC_FIREBASE_CONFIG thiếu apiKey/projectId/appId — dùng config production.');
      return null;
    }
    return {
      apiKey: c.apiKey,
      authDomain: c.authDomain || `${c.projectId}.firebaseapp.com`,
      projectId: c.projectId,
      storageBucket: c.storageBucket || `${c.projectId}.firebasestorage.app`,
      messagingSenderId: c.messagingSenderId || '',
      appId: c.appId,
    };
  } catch (e: any) {
    console.error('[Firebase] NEXT_PUBLIC_FIREBASE_CONFIG không phải JSON hợp lệ — dùng config production:', e?.message);
    return null;
  }
};

const firebaseConfig = docConfigTuEnv() || configProduction;

// ===== CONFIG PROJECT THỬ (app-bao-cao-tien-do-da-ver2) — chỉ dán vào biến trên khi cần chạy
//       NEXT_PUBLIC_DEV_CLOUD_TEST=1, XONG PHẢI ĐỔI LẠI khối production ở trên.
// const firebaseConfig = {
//   apiKey: 'AIzaSyAztEX0TNSNBKItcKZXlSHYe0JadrdMU3o',
//   authDomain: 'app-bao-cao-tien-do-da-ver2.firebaseapp.com',
//   projectId: 'app-bao-cao-tien-do-da-ver2',
//   storageBucket: 'app-bao-cao-tien-do-da-ver2.firebasestorage.app',
//   messagingSenderId: '697443458137',
//   appId: '1:697443458137:web:52f5af201000982097e548',
// };

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

/** projectId Firebase đang chạy — để App.tsx chặn chế độ thử-cloud nếu đang trỏ project THẬT. */
export const projectIdDangChay = (): string => fbApp.options.projectId || '';

/** Project Firebase chứa dữ liệu THẬT của Phòng — không được đem ra thử nghiệm ghi/xóa. */
export const PROJECT_THAT = 'hpcons-dauthau';

/**
 * Đăng nhập ẨN DANH — chỉ dùng cho chế độ thử-cloud trên máy cá nhân (NEXT_PUBLIC_DEV_CLOUD_TEST),
 * nơi SSO App Tổng không chạy được vì cookie phiên chỉ gửi tới subdomain hpcore.vn.
 * Cần bật Anonymous sign-in trong Firebase Console của project THỬ (đừng bật ở project thật).
 */
export const signInAnonymouslyFb = (): Promise<void> =>
  signInAnonymously(fbAuth).then(() => undefined);

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

  // Gom mọi phép ghi rồi chia lô — Firestore chỉ cho TỐI ĐA 500 phép ghi mỗi writeBatch.
  // Trước đây dồn hết vào 1 batch: khôi phục bản sao lưu nhiều hồ sơ là commit trượt SẠCH,
  // cloud giữ nguyên dữ liệu cũ nên người dùng tưởng "khôi phục không được".
  const ghi: Array<(b: ReturnType<typeof writeBatch>) => void> = [];
  existing.docs.forEach((d) => {
    if (!keep.has(d.id)) ghi.push((b) => b.delete(d.ref));
  });
  items.forEach((i) => {
    // id rỗng làm doc() ném lỗi và kéo sập cả lô — bỏ qua bản ghi không có mã
    if (!i?.id) return;
    ghi.push((b) => b.set(doc(fsDb, colName, i.id), sanitize(i)));
  });

  const CO_LO = 450; // chừa biên dưới mức 500 của Firestore
  for (let i = 0; i < ghi.length; i += CO_LO) {
    const batch = writeBatch(fsDb);
    ghi.slice(i, i + CO_LO).forEach((apply) => apply(batch));
    await batch.commit();
  }
}

/**
 * Xoá NGAY các doc theo id trên cloud — dùng cho thao tác "xoá" thay vì chỉ
 * cập nhật state cục bộ rồi chờ effect debounce đẩy cả mảng lên (pushCollection
 * ở trên). Lý do: effect debounce chạy `getDocs()` đọc lại toàn bộ collection
 * TRƯỚC KHI tính diff xoá — nếu có 1 pushCollection khác đang chạy dở (từ thao
 * tác ngay trước đó) commit SAU lần đẩy phản ánh việc xoá này, bản ghi vừa xoá
 * có thể bị ghi đè trở lại (đúng triệu chứng góp ý: "xoá dự án còn kẹt 1 gói
 * thầu... xoá xong sẽ quay lại như cũ"). Gọi hàm này NGAY khi xác nhận xoá để
 * đảm bảo cloud phản ánh đúng ngay lập tức, không phụ thuộc thời điểm effect
 * debounce chạy tới.
 */
export async function deleteDocsFromCollection(colName: string, ids: string[]): Promise<void> {
  const validIds = ids.filter(Boolean);
  if (validIds.length === 0) return;
  const CO_LO = 450;
  for (let i = 0; i < validIds.length; i += CO_LO) {
    const batch = writeBatch(fsDb);
    validIds.slice(i, i + CO_LO).forEach((id) => batch.delete(doc(fsDb, colName, id)));
    await batch.commit();
  }
}

/**
 * Lắng nghe realtime một collection. Trả về hàm hủy đăng ký.
 * onData nhận (items, isEmpty) — isEmpty=true khi collection chưa có dữ liệu trên cloud.
 * onError (tùy chọn) để App báo ra MÀN HÌNH — chỉ ghi console là người dùng chỉ thấy app
 * trắng dữ liệu mà không biết vì sao (hay gặp nhất: Rules chặn, hoặc mạng chặn Firestore).
 */
export function subscribeCollection<T>(
  colName: string,
  onData: (items: T[], isEmpty: boolean) => void,
  onError?: (colName: string, message: string) => void
): Unsubscribe {
  return onSnapshot(
    collection(fsDb, colName),
    (snap) => {
      const items = snap.docs.map((d) => d.data() as T);
      onData(items, snap.empty);
    },
    (err) => {
      console.error(`[Firebase] Lỗi lắng nghe collection "${colName}" (kiểm tra Rules trên Firebase Console):`, err.message);
      onError?.(colName, err.message);
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
